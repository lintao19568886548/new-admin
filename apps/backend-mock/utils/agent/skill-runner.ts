import type { AgentContext, PlanStep, SkillResult } from './types';

import { getHeader } from 'h3';

import { auditAgentAction } from './audit-service';
import { assertAgentSkillPermission } from './permission-guard';
import { getSkill } from './skill-registry';
import { createAgentTaskStep, finishAgentTaskStep } from './task-repository';

export class AgentSkillExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentSkillExecutionError';
  }
}

export async function runAgentSkillStep(params: {
  context: AgentContext;
  step: PlanStep;
  stepNo: number;
  taskId: string;
}): Promise<SkillResult> {
  const skill = getSkill(params.step.skillName);
  if (!skill || skill.enabled === false) {
    throw new AgentSkillExecutionError(
      `Agent Skill 不存在或未启用：${params.step.skillName}`,
    );
  }

  assertAgentSkillPermission(params.context, skill);

  const riskLevel = params.step.riskLevel || skill.riskLevel;
  const requiresApproval = Boolean(
    params.step.requiresApproval || skill.requiresApproval,
  );
  const stepId = await createAgentTaskStep({
    input: params.step.input,
    requiresApproval,
    riskLevel,
    skillName: skill.name,
    stepName: params.step.stepName,
    stepNo: params.stepNo,
    taskId: params.taskId,
  });
  const startedAt = Date.now();

  try {
    if (requiresApproval) {
      await finishAgentTaskStep({
        output: { message: '该步骤需要审批后执行' },
        status: 'waiting_approval',
        stepId,
      });
      return {
        output: {
          message: '该步骤需要审批后执行',
          waitingApproval: true,
        },
        summary: '等待审批',
      };
    }

    await auditAgentAction({
      actionType: `skill:${skill.name}:start`,
      input: params.step.input,
      riskLevel,
      stepId,
      taskId: params.taskId,
      userAgent: getHeader(params.context.event, 'user-agent') || undefined,
      userId: params.context.userinfo.id,
    });

    const result = await skill.handler(params.step.input || {}, {
      ...params.context,
      step: params.step,
      stepId,
      taskId: params.taskId,
    });

    await finishAgentTaskStep({
      durationMs: Date.now() - startedAt,
      output: result.output,
      status: 'succeeded',
      stepId,
    });
    await auditAgentAction({
      actionType: `skill:${skill.name}:succeeded`,
      output: result.output,
      riskLevel,
      stepId,
      taskId: params.taskId,
      userAgent: getHeader(params.context.event, 'user-agent') || undefined,
      userId: params.context.userinfo.id,
    });
    return result;
  } catch (error: any) {
    await finishAgentTaskStep({
      durationMs: Date.now() - startedAt,
      errorMessage: String(error?.message || error || ''),
      output: { message: String(error?.message || error || '') },
      status: 'failed',
      stepId,
    });
    await auditAgentAction({
      actionType: `skill:${skill.name}:failed`,
      output: { message: String(error?.message || error || '') },
      riskLevel,
      stepId,
      taskId: params.taskId,
      userAgent: getHeader(params.context.event, 'user-agent') || undefined,
      userId: params.context.userinfo.id,
    });
    throw error;
  }
}

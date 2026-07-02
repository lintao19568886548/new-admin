import type {
  AgentContext,
  AgentTaskRecord,
  AgentTaskStepRecord,
  RunAgentTaskInput,
} from './types';

import { resolveContextParkId } from './permission-guard';
import { planAgentTask } from './planner';
import { runAgentSkillStep } from './skill-runner';
import { registerBuiltinAgentSkills } from './skills';
import {
  createAgentTask,
  finishAgentTask,
  getAgentTaskDetail,
  updateAgentTaskPlan,
} from './task-repository';

export interface AgentRunResult {
  result: Record<string, unknown>;
  steps: AgentTaskStepRecord[];
  task: AgentTaskRecord;
}

export async function runAgentTask(params: {
  context: AgentContext;
  request: RunAgentTaskInput;
}): Promise<AgentRunResult> {
  registerBuiltinAgentSkills();

  const taskId = await createAgentTask({
    context: {
      organizationId: params.context.organizationId,
      parkId: resolveContextParkId(params.context),
      userId: params.context.userinfo.id,
    },
    request: params.request,
  });
  const plan = planAgentTask(params.request);
  await updateAgentTaskPlan({ plan, taskId });

  const stepOutputs: Record<string, unknown>[] = [];
  try {
    for (const [index, step] of plan.steps.entries()) {
      const result = await runAgentSkillStep({
        context: params.context,
        step,
        stepNo: index + 1,
        taskId,
      });
      stepOutputs.push({
        skillName: step.skillName,
        summary: result.summary,
        ...result.output,
      });
    }

    const finalResult = {
      outputs: stepOutputs,
      reply:
        stepOutputs
          .map((item) => String((item as any).reply || ''))
          .find(Boolean) || '',
    };
    await finishAgentTask({
      result: finalResult,
      status: 'succeeded',
      taskId,
    });
  } catch (error: any) {
    const message = String(error?.message || error || '');
    await finishAgentTask({
      errorMessage: message,
      result: {
        message,
        outputs: stepOutputs,
      },
      status: 'failed',
      taskId,
    });
    throw error;
  }

  const detail = await getAgentTaskDetail({
    taskId,
    userId: params.context.userinfo.id,
  });
  if (!detail) {
    throw new Error('Agent 任务创建后无法读取详情');
  }
  return {
    result: detail.task.result || {},
    steps: detail.steps,
    task: detail.task,
  };
}

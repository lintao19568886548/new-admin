import type { ExecutionPlan, RunAgentTaskInput } from './types';

export function planAgentTask(request: RunAgentTaskInput): ExecutionPlan {
  return {
    agentCode: request.agentCode,
    steps: [
      {
        input: request.input,
        requiresApproval: false,
        riskLevel: 'low',
        skillName: 'llm_chat_response',
        stepName: '生成业务回复',
      },
    ],
    summary: '当前阶段先将工作台消息包装为低风险 Agent 任务步骤执行。',
  };
}

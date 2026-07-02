import type { H3Event } from 'h3';
import type { UserInfoForToken } from '~/utils/user-service';

export type AgentRiskLevel = 'high' | 'low' | 'medium';

export type AgentTaskStatus =
  | 'cancelled'
  | 'failed'
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'waiting_approval';

export type AgentTaskStepStatus =
  | 'failed'
  | 'pending'
  | 'running'
  | 'skipped'
  | 'succeeded'
  | 'waiting_approval';

export interface AgentChatMessage {
  content: string;
  role: 'assistant' | 'system' | 'user';
}

export interface AgentContext {
  event: H3Event;
  organizationId?: number;
  parkId?: number;
  userinfo: UserInfoForToken;
}

export interface AgentTaskRecord {
  agentCode: string;
  createTime: string;
  currentStepNo?: null | number;
  errorMessage?: null | string;
  finishedAt?: null | string;
  id: string;
  input: Record<string, unknown>;
  organizationId?: null | number;
  parkId?: null | number;
  plan?: null | Record<string, unknown>;
  result?: null | Record<string, unknown>;
  sourceModule?: null | string;
  sourcePage?: null | string;
  sourceRecordId?: null | string;
  startedAt?: null | string;
  status: AgentTaskStatus;
  updateTime: string;
  userId: number;
}

export interface AgentTaskStepRecord {
  approvalId?: null | string;
  createTime: string;
  durationMs?: null | number;
  errorMessage?: null | string;
  finishedAt?: null | string;
  id: string;
  input?: null | Record<string, unknown>;
  output?: null | Record<string, unknown>;
  requiresApproval: boolean;
  riskLevel: AgentRiskLevel;
  skillName?: null | string;
  startedAt?: null | string;
  status: AgentTaskStepStatus;
  stepName: string;
  stepNo: number;
  taskId: string;
  updateTime: string;
}

export interface ExecutionPlan {
  agentCode: string;
  steps: PlanStep[];
  summary: string;
}

export interface PlanStep {
  input?: Record<string, unknown>;
  requiresApproval?: boolean;
  riskLevel?: AgentRiskLevel;
  skillName: string;
  stepName: string;
}

export interface SkillDefinition<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput extends Record<string, unknown> = Record<string, unknown>,
> {
  description?: string;
  enabled?: boolean;
  handler: (
    input: TInput,
    context: AgentSkillExecutionContext,
  ) => Promise<SkillResult<TOutput>>;
  name: string;
  permissionCode?: string;
  requiresApproval?: boolean;
  riskLevel: AgentRiskLevel;
  title: string;
}

export interface AgentSkillExecutionContext extends AgentContext {
  step: PlanStep;
  stepId: string;
  taskId: string;
}

export interface SkillResult<
  TOutput extends Record<string, unknown> = Record<string, unknown>,
> {
  output: TOutput;
  summary?: string;
}

export interface RunAgentTaskInput {
  agentCode: string;
  input: Record<string, unknown>;
  sourceModule?: string;
  sourcePage?: string;
  sourceRecordId?: string;
}

import { requestClient } from '#/api/request';

const AGENT_CHAT_TIMEOUT_MS = 120_000;

export type AgentChatRole = 'assistant' | 'system' | 'user';

export interface AgentChatMessage {
  content: string;
  role: AgentChatRole;
}

export interface AgentChatRequest {
  agentId?: string;
  context?: Record<string, unknown>;
  messages: AgentChatMessage[];
  model?: string;
}

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

export type AgentRiskLevel = 'high' | 'low' | 'medium';

export interface AgentTask {
  agentCode: string;
  createTime: string;
  currentStepNo?: null | number;
  errorMessage?: null | string;
  finishedAt?: null | string;
  id: string;
  input?: Record<string, unknown>;
  organizationId?: null | number;
  parkId?: null | number;
  plan?: null | Record<string, unknown>;
  result?: null | Record<string, unknown>;
  sourceModule?: null | string;
  sourcePage?: null | string;
  sourceRecordId?: null | string;
  startedAt?: null | string;
  status: AgentTaskStatus;
  updateTime?: string;
  userId: number;
}

export interface AgentTaskStep {
  durationMs?: null | number;
  errorMessage?: null | string;
  finishedAt?: null | string;
  id: string;
  output?: null | Record<string, unknown>;
  requiresApproval: boolean;
  riskLevel: AgentRiskLevel;
  skillName?: null | string;
  startedAt?: null | string;
  status: AgentTaskStepStatus;
  stepName: string;
  stepNo: number;
  taskId: string;
  updateTime?: string;
}

export interface AgentChatResponse {
  agentCode?: string;
  agentId: string;
  createdAt: string;
  model: string;
  reply: string;
  result?: Record<string, unknown>;
  status?: AgentTaskStatus;
  steps?: AgentTaskStep[];
  task?: AgentTask;
  taskId?: string;
  usage?: null | Record<string, unknown>;
}

export interface AgentTaskListResponse {
  items: AgentTask[];
  total: number;
}

export interface AgentTaskDetailResponse {
  steps: AgentTaskStep[];
  task: AgentTask;
}

export interface AgentSkill {
  description: string;
  enabled: boolean;
  name: string;
  permissionCode: null | string;
  requiresApproval: boolean;
  riskLevel: AgentRiskLevel;
  title: string;
}

export interface AgentSkillListResponse {
  items: AgentSkill[];
}

export async function sendAgentChatApi(payload: AgentChatRequest) {
  return requestClient.post<AgentChatResponse>('/agent/chat', payload, {
    silentError: true,
    timeout: AGENT_CHAT_TIMEOUT_MS,
  });
}

export async function getAgentTaskListApi(params?: {
  currentPage?: number;
  pageSize?: number;
  status?: AgentTaskStatus;
}) {
  return requestClient.get<AgentTaskListResponse>('/agent/tasks', { params });
}

export async function getAgentTaskDetailApi(taskId: string) {
  return requestClient.get<AgentTaskDetailResponse>(`/agent/tasks/${taskId}`);
}

export async function getAgentSkillListApi() {
  return requestClient.get<AgentSkillListResponse>('/agent/skills');
}

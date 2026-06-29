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

export interface AgentChatResponse {
  agentId: string;
  createdAt: string;
  model: string;
  reply: string;
  usage?: null | Record<string, unknown>;
}

export async function sendAgentChatApi(payload: AgentChatRequest) {
  return requestClient.post<AgentChatResponse>('/agent/chat', payload, {
    silentError: true,
    timeout: AGENT_CHAT_TIMEOUT_MS,
  });
}

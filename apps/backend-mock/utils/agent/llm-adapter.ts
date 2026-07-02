import type { AgentChatMessage } from './types';

import { getContentText, requestBailianChat } from '~/utils/bailian';

export interface AgentLlmChatParams {
  messages: AgentChatMessage[];
  model: string;
  temperature?: number;
}

export class AgentLlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentLlmError';
  }
}

function getErrorMessage(error: any) {
  if (error?.code === 'ECONNABORTED') {
    return 'AI模型响应超时，请稍后重试，或切换 qwen-turbo 后再试';
  }

  return String(
    error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      '',
  );
}

export async function chatWithLlm(params: AgentLlmChatParams) {
  try {
    const completion = await requestBailianChat({
      messages: params.messages,
      model: params.model,
      temperature: params.temperature ?? 0.2,
    });
    return {
      reply: getContentText(completion?.choices?.[0]?.message?.content),
      usage: completion?.usage || null,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    throw new AgentLlmError(message || 'Agent回复失败，请稍后重试');
  }
}

export async function chatJsonWithLlm<T = Record<string, unknown>>(
  params: AgentLlmChatParams,
): Promise<T> {
  const result = await chatWithLlm(params);
  const raw = String(result.reply || '').trim();
  const jsonText = raw
    .replace(/^```json\s*/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    throw new AgentLlmError('模型没有返回有效 JSON');
  }
}

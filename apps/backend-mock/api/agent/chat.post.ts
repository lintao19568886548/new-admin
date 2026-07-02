import type { AgentChatMessage } from '~/utils/agent/types';

import { runAgentTask } from '~/utils/agent/agent-runner';
import { AgentLlmError } from '~/utils/agent/llm-adapter';
import { AgentSchemaNotReadyError } from '~/utils/agent/task-repository';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

interface AgentChatRequestMessage {
  content?: unknown;
  role?: unknown;
}

interface AgentChatRequestBody {
  agentId?: unknown;
  context?: Record<string, unknown>;
  messages?: AgentChatRequestMessage[];
  model?: unknown;
}

const DEFAULT_AGENT_MODEL = 'qwen3.5-plus';
const MAX_MESSAGE_COUNT = 16;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 18_000;
const ALLOWED_MODELS = new Set([
  'qwen3.5-plus',
  'qwen-long',
  'qwen-max',
  'qwen-plus',
  'qwen-turbo',
]);
const AGENT_CODE_ALIASES: Record<string, string> = {
  bill: 'bill_finance',
  bill_finance: 'bill_finance',
  crm: 'crm_sales',
  crm_sales: 'crm_sales',
  investment_radar: 'investment_radar',
  maintenance: 'maintenance',
  operations: 'operations',
  rental_asset: 'rental_asset',
  system_ops: 'system_ops',
};

function normalizeAgentCode(value: unknown) {
  const agentId = String(value || '').trim();
  return AGENT_CODE_ALIASES[agentId] || 'operations';
}

function normalizeModel(value: unknown) {
  const model = String(value || '').trim();
  return ALLOWED_MODELS.has(model) ? model : DEFAULT_AGENT_MODEL;
}

function normalizeRole(value: unknown): AgentChatMessage['role'] {
  return value === 'assistant' || value === 'system' || value === 'user'
    ? value
    : 'user';
}

function normalizeMessageContent(value: unknown) {
  return String(value || '')
    .split('\0')
    .join('')
    .trim()
    .slice(0, MAX_MESSAGE_CHARS);
}

function normalizeMessages(messages: unknown): AgentChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  const normalized = messages
    .map((item) => ({
      content: normalizeMessageContent(
        (item as AgentChatRequestMessage)?.content,
      ),
      role: normalizeRole((item as AgentChatRequestMessage)?.role),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_MESSAGE_COUNT);

  let totalChars = 0;
  const result: AgentChatMessage[] = [];
  for (const item of [...normalized].reverse()) {
    totalChars += item.content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      break;
    }
    result.unshift(item);
  }

  return result;
}

function toPositiveInteger(value: unknown) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0
    ? Math.floor(numberValue)
    : undefined;
}

function resolveReplyFromResult(result: Record<string, unknown>) {
  const directReply = String(result.reply || '').trim();
  if (directReply) {
    return directReply;
  }
  const outputs = Array.isArray(result.outputs) ? result.outputs : [];
  return (
    outputs
      .map((item) => String((item as Record<string, unknown>)?.reply || ''))
      .find((text) => text.trim().length > 0) ||
    '我暂时没有生成有效回复，请换一种问法再试。'
  );
}

function getErrorMessage(error: any) {
  return String(
    error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      '',
  );
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = ((await readBody(event).catch(() => ({}))) ||
    {}) as AgentChatRequestBody;
  const agentCode = normalizeAgentCode(body.agentId);
  const model = normalizeModel(body.model);
  const messages = normalizeMessages(body.messages);

  if (messages.length === 0 || messages.at(-1)?.role !== 'user') {
    return badRequestResponse('请输入要发送给 Agent 的内容', event);
  }

  try {
    const runResult = await runAgentTask({
      context: {
        event,
        organizationId: toPositiveInteger(
          (body.context || {}).organizationId ?? event.context.organizationId,
        ),
        parkId: toPositiveInteger(
          (body.context || {}).parkId ?? event.context.currentParkId,
        ),
        userinfo,
      },
      request: {
        agentCode,
        input: {
          agentCode,
          context: body.context || {},
          messages,
          model,
        },
        sourceModule: 'agent',
        sourcePage: 'dashboard-agent-workbench',
      },
    });
    const reply = resolveReplyFromResult(runResult.result);

    return useResponseSuccess({
      agentId: body.agentId || agentCode,
      agentCode,
      createdAt: runResult.task.createTime,
      model,
      reply,
      result: runResult.result,
      status: runResult.task.status,
      steps: runResult.steps,
      task: runResult.task,
      taskId: runResult.task.id,
      usage:
        runResult.result.outputs &&
        Array.isArray(runResult.result.outputs) &&
        runResult.result.outputs[0]
          ? (runResult.result.outputs[0] as Record<string, unknown>).usage ||
            null
          : null,
    });
  } catch (error: any) {
    console.error(
      '[agent][chat] request failed:',
      error?.response?.data || error,
    );
    const messageText = getErrorMessage(error);
    if (error instanceof AgentSchemaNotReadyError) {
      return serverErrorResponse(error.message, event);
    }
    if (
      error instanceof AgentLlmError &&
      messageText.includes('ALIYUN_BAILIAN_KEY')
    ) {
      return serverErrorResponse(
        'AI服务未配置，请在系统密钥中配置 ALIYUN_BAILIAN_KEY',
        event,
      );
    }
    if (messageText.includes('ALIYUN_BAILIAN_KEY')) {
      return serverErrorResponse(
        'AI服务未配置，请在系统密钥中配置 ALIYUN_BAILIAN_KEY',
        event,
      );
    }
    return serverErrorResponse(
      messageText || 'Agent回复失败，请稍后重试',
      event,
    );
  }
});

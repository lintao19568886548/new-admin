import { getContentText, requestBailianChat } from '~/utils/bailian';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

type AgentChatRole = 'assistant' | 'system' | 'user';

interface AgentChatMessage {
  content?: unknown;
  role?: unknown;
}

interface AgentChatRequestBody {
  agentId?: unknown;
  context?: Record<string, unknown>;
  messages?: AgentChatMessage[];
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

const AGENT_PROMPTS: Record<string, string> = {
  bill: '你偏向账单、催收、财务收支、园区费用核算，输出要能直接给运营或财务人员使用。',
  crm: '你偏向获客推广、销售绑定、客户跟进、招商线索转化，输出要具体到话术、下一步动作和风险点。',
  maintenance:
    '你偏向维修巡检、消防、电梯、厂房维护、卫生检查，输出要包含处理优先级和闭环检查项。',
  operations:
    '你偏向园区综合运营，覆盖招商、租赁、账单、人员、门禁、公告和经营看板。',
};

function normalizeAgentId(value: unknown) {
  const agentId = String(value || '').trim();
  return Object.hasOwn(AGENT_PROMPTS, agentId) ? agentId : 'operations';
}

function normalizeModel(value: unknown) {
  const model = String(value || '').trim();
  return ALLOWED_MODELS.has(model) ? model : DEFAULT_AGENT_MODEL;
}

function normalizeRole(value: unknown): AgentChatRole {
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

function normalizeMessages(messages: unknown) {
  if (!Array.isArray(messages)) {
    return [];
  }

  const normalized = messages
    .map((item) => ({
      content: normalizeMessageContent((item as AgentChatMessage)?.content),
      role: normalizeRole((item as AgentChatMessage)?.role),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_MESSAGE_COUNT);

  let totalChars = 0;
  const result = [];
  for (const item of [...normalized].reverse()) {
    totalChars += item.content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      break;
    }
    result.unshift(item);
  }

  return result;
}

function buildSystemPrompt(params: {
  agentId: string;
  realName?: string;
  roles?: unknown;
}) {
  const roleText = Array.isArray(params.roles)
    ? params.roles.join(',')
    : String(params.roles || '');

  return [
    '你是“瞰维智管-智慧园区管理系统”的 Agent 工作台助手。',
    '你面向园区管理人员，回答要围绕真实业务动作，不写空泛宣传。',
    '当前系统模块包括：总台、租赁管理、账单管理、财务管理、招商管理、获客推广、人员考勤、维修巡检、门禁访客、公告反馈、系统权限。',
    AGENT_PROMPTS[params.agentId] || AGENT_PROMPTS.operations,
    params.realName ? `当前登录用户：${params.realName}` : '',
    roleText ? `当前用户角色：${roleText}` : '',
    '回答要求：用中文；先给结论，再给可执行步骤；涉及数据时说明需要用户提供或进入哪个系统模块核对；不要编造系统里不存在的数据。',
  ]
    .filter(Boolean)
    .join('\n');
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

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = ((await readBody(event).catch(() => ({}))) ||
    {}) as AgentChatRequestBody;
  const agentId = normalizeAgentId(body.agentId);
  const model = normalizeModel(body.model);
  const messages = normalizeMessages(body.messages);

  if (messages.length === 0 || messages.at(-1)?.role !== 'user') {
    return badRequestResponse('请输入要发送给 Agent 的内容', event);
  }

  try {
    const startedAt = Date.now();
    console.info('[agent][chat] request start', {
      agentId,
      messageCount: messages.length,
      model,
      userId: userinfo.id,
    });

    const completion = await requestBailianChat({
      messages: [
        {
          content: buildSystemPrompt({
            agentId,
            realName: String(userinfo.realName || userinfo.username || ''),
            roles: userinfo.roles,
          }),
          role: 'system',
        },
        ...messages,
      ],
      model,
      temperature: 0.2,
    });

    const reply = getContentText(completion?.choices?.[0]?.message?.content);
    console.info('[agent][chat] request done', {
      agentId,
      durationMs: Date.now() - startedAt,
      hasReply: Boolean(reply),
      model,
    });

    return useResponseSuccess({
      agentId,
      createdAt: new Date().toISOString(),
      model,
      reply: reply || '我暂时没有生成有效回复，请换一种问法再试。',
      usage: completion?.usage || null,
    });
  } catch (error: any) {
    console.error(
      '[agent][chat] request failed:',
      error?.response?.data || error,
    );
    const messageText = getErrorMessage(error);
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

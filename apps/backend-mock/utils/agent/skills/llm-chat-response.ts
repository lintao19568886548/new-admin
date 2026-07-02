import type { AgentChatMessage, SkillDefinition } from '../types';

import { chatWithLlm } from '../llm-adapter';

const AGENT_PROMPTS: Record<string, string> = {
  bill_finance:
    '你偏向账单、催收、财务收支、园区费用核算，输出要能直接给运营或财务人员使用。',
  crm_sales:
    '你偏向获客推广、销售绑定、客户跟进、招商线索转化，输出要具体到话术、下一步动作和风险点。',
  maintenance:
    '你偏向维修巡检、消防、电梯、厂房维护、卫生检查，输出要包含处理优先级和闭环检查项。',
  operations:
    '你偏向园区综合运营，覆盖招商、租赁、账单、人员、门禁、公告和经营看板。',
  rental_asset:
    '你偏向园区资产、厂房、楼层、宿舍、租户和合同，输出要体现资产与租赁管理动作。',
};

function buildSystemPrompt(params: {
  agentCode: string;
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
    AGENT_PROMPTS[params.agentCode] || AGENT_PROMPTS.operations,
    params.realName ? `当前登录用户：${params.realName}` : '',
    roleText ? `当前用户角色：${roleText}` : '',
    '回答要求：用中文；先给结论，再给可执行步骤；涉及数据时说明需要用户提供或进入哪个系统模块核对；不要编造系统里不存在的数据。',
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizeMessages(value: unknown): AgentChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const role = (item as AgentChatMessage)?.role;
      const content = String((item as AgentChatMessage)?.content || '').trim();
      if (
        !content ||
        (role !== 'assistant' && role !== 'system' && role !== 'user')
      ) {
        return null;
      }
      return { content, role };
    })
    .filter((item): item is AgentChatMessage => item !== null);
}

export const llmChatResponseSkill: SkillDefinition = {
  description: '将 Agent 工作台消息发送给统一 LLM Adapter 并返回业务回复',
  async handler(input, context) {
    const messages = normalizeMessages(input.messages);
    const model = String(input.model || 'qwen3.5-plus');
    const result = await chatWithLlm({
      messages: [
        {
          content: buildSystemPrompt({
            agentCode: String(input.agentCode || 'operations'),
            realName: String(
              context.userinfo.realName || context.userinfo.username || '',
            ),
            roles: context.userinfo.roles,
          }),
          role: 'system',
        },
        ...messages,
      ],
      model,
      temperature: 0.2,
    });

    return {
      output: {
        model,
        reply: result.reply || '我暂时没有生成有效回复，请换一种问法再试。',
        usage: result.usage,
      },
      summary: '已生成工作台业务回复',
    };
  },
  name: 'llm_chat_response',
  requiresApproval: false,
  riskLevel: 'low',
  title: '工作台业务回复',
};

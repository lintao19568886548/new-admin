import type { H3Event } from 'h3';
import type { BailianChatMessage } from '~/utils/bailian';

import { requestBailianChatStream } from '~/utils/bailian';
import { findSmartServicePresetReply } from '~/utils/smart-service-knowledge';

type ClientChatRole = 'assistant' | 'system' | 'user';

interface ClientChatMessage {
  content?: unknown;
  role?: unknown;
}

interface SmartServiceChatBody {
  messages?: ClientChatMessage[];
  model?: unknown;
  stream?: unknown;
}

const SMART_SERVICE_SYSTEM_PROMPT = `你是一位专业的智能客服助手，服务于本 App 的用户。
你的职责：
- 回答用户关于产品使用、订单查询、账户问题、功能介绍等常见问题
- 语气友好、耐心、专业，使用中文回答
- 尽量使用清晰的步骤化回复；涉及操作指引时使用 1. 2. 3. 的编号步骤
- 回复要简洁但有温度，可以使用少量合适的表情符号
- 如果用户问题超出知识范围，礼貌引导用户联系人工客服
- 不要编造不存在的产品功能或政策
- 涉及敏感操作（如修改密码、注销账户）时，提醒用户通过官方渠道操作

产品内已有的常见入口：
- 修改密码：个人中心 -> 修改密码
- 意见反馈：个人中心 -> 意见反馈
- 会员服务、个人名片、隐私政策、服务协议、账号注销：个人中心 -> 更多功能
- 检查更新：原生 App 的个人中心页面可见

如果用户要求查询订单、账单、合同、报修等具体业务数据，而你无法直接读取系统实时数据，请说明需要用户在对应业务页面查看，或联系人工客服协助核实。`;

function normalizeModel(model: unknown) {
  return typeof model === 'string' && model.trim() ? model.trim() : 'qwen-plus';
}

function isSupportedRole(role: unknown): role is ClientChatRole {
  return role === 'assistant' || role === 'system' || role === 'user';
}

function normalizeMessages(messages: unknown): BailianChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message): BailianChatMessage | null => {
      const item = message as ClientChatMessage;
      const content =
        typeof item.content === 'string' ? item.content.trim() : '';
      if (!isSupportedRole(item.role) || !content) {
        return null;
      }
      return {
        content: content.slice(0, 4000),
        role: item.role,
      };
    })
    .filter(Boolean)
    .slice(-12);
}

function writeSseData(event: H3Event, data: unknown) {
  event.node.res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function writeSseDone(event: H3Event) {
  event.node.res.write('data: [DONE]\n\n');
}

function getLatestUserQuestion(messages: BailianChatMessage[]) {
  const latestUserMessage = messages.findLast(
    (message) => message.role === 'user',
  );
  return typeof latestUserMessage?.content === 'string'
    ? latestUserMessage.content
    : '';
}

async function writePresetReplyStream(
  event: H3Event,
  answer: string,
  signal: AbortSignal,
) {
  const chunks = answer.match(/[\s\S]{1,18}/g) || [];
  for (const chunk of chunks) {
    if (signal.aborted || event.node.res.writableEnded) {
      return;
    }
    writeSseData(event, {
      choices: [
        {
          delta: {
            content: chunk,
          },
        },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 18));
  }
}

export default eventHandler(async (event) => {
  const body = ((await readBody(event).catch(() => ({}))) ||
    {}) as SmartServiceChatBody;
  const controller = new AbortController();
  const messages = normalizeMessages(body.messages);
  let responseFinished = false;

  event.node.res.on('finish', () => {
    responseFinished = true;
  });
  event.node.res.on('close', () => {
    if (!responseFinished) {
      controller.abort();
    }
  });
  event.node.res.setHeader('Cache-Control', 'no-cache, no-transform');
  event.node.res.setHeader('Connection', 'keep-alive');
  event.node.res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  event.node.res.setHeader('X-Accel-Buffering', 'no');

  if (messages.length === 0 || messages.at(-1)?.role !== 'user') {
    event.node.res.statusCode = 400;
    writeSseData(event, {
      error: {
        message: '请输入需要咨询的问题',
        type: 'bad_request',
      },
    });
    writeSseDone(event);
    event.node.res.end();
    return;
  }

  const presetReply = findSmartServicePresetReply(
    getLatestUserQuestion(messages),
  );
  if (presetReply) {
    await writePresetReplyStream(event, presetReply.answer, controller.signal);
    writeSseDone(event);
    event.node.res.end();
    return;
  }

  const bailianMessages: BailianChatMessage[] = [
    {
      content: SMART_SERVICE_SYSTEM_PROMPT,
      role: 'system',
    },
    ...messages.filter((message) => message.role !== 'system'),
  ];

  try {
    const response = await requestBailianChatStream({
      maxTokens: 1200,
      messages: bailianMessages,
      model: normalizeModel(body.model),
      signal: controller.signal,
      temperature: 0.3,
    });
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      event.node.res.write(value);
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      const message =
        error instanceof Error ? error.message : '智能客服响应失败';
      console.error('[smart-service] chat stream failed:', message);
      writeSseData(event, {
        error: {
          message,
          type: message.includes('timeout') ? 'timeout' : 'api_error',
        },
      });
    }
  } finally {
    if (!event.node.res.writableEnded) {
      writeSseDone(event);
      event.node.res.end();
    }
  }
});

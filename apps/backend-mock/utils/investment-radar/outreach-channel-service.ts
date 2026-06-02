import { createHash, createHmac } from 'node:crypto';

export type OutreachChannel = 'CALL' | 'EMAIL' | 'SMS' | 'WECHAT' | string;

export interface OutreachDeliveryPayload {
  channel: OutreachChannel;
  companyName?: null | string;
  contactName?: null | string;
  content: string;
  leadId?: null | number;
  phoneNumber?: null | string;
  subject?: null | string;
  taskId: number;
  templateCode?: null | string;
}

export interface OutreachDeliveryResult {
  providerResponse?: unknown;
  providerTaskId?: null | string;
  resultCode: string;
  resultMessage: string;
  success: boolean;
}

interface ShlianluSmsConfig {
  apiHost: string;
  appId: string;
  mchId: string;
  secretKey: string;
  signName: string;
  signType: 'HMACSHA256' | 'MD5';
  type: string;
  version: string;
}

const SIGNATURE_EXCLUDED_KEYS = new Set([
  'ContextParamSet',
  'PhoneList',
  'PhoneNumberSet',
  'phoneSet',
  'SessionContext',
  'SessionContextSet',
  'Signature',
  'TemplateParamSet',
]);

let wecomAccessTokenCache: null | {
  expiresAt: number;
  token: string;
} = null;

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function readJsonEnv(name: string): Record<string, string> {
  const raw = normalizeText(process.env[name]);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getRequiredEnv(name: string) {
  const value = normalizeText(process.env[name]);
  if (!value) {
    throw new Error(`缺少触达通道配置：${name}`);
  }
  return value;
}

function loadSmsConfig(): ShlianluSmsConfig {
  const signType = normalizeText(
    process.env.SMS_SIGN_TYPE || 'MD5',
  ).toUpperCase();
  if (signType !== 'MD5' && signType !== 'HMACSHA256') {
    throw new Error(`不支持的短信签名方式：${signType}`);
  }

  return {
    apiHost:
      normalizeText(process.env.SMS_PERSONAL_API_HOST) ||
      'https://apis.shlianlu.com/sms/trade/personal/send',
    appId: getRequiredEnv('SMS_APP_ID'),
    mchId: getRequiredEnv('SMS_MCH_ID'),
    secretKey: getRequiredEnv('SMS_SECRET_KEY'),
    signName:
      normalizeText(process.env.SMS_SIGN_NAME) ||
      '【东莞市宜租网络科技有限公司】',
    signType,
    type:
      normalizeText(process.env.SMS_PERSONAL_TYPE || process.env.SMS_TYPE) ||
      '2',
    version:
      normalizeText(
        process.env.SMS_PERSONAL_VERSION || process.env.SMS_VERSION,
      ) || '1.2.0',
  };
}

function buildSignatureString(
  payload: Record<string, unknown>,
  secretKey: string,
) {
  const sortedParams = Object.keys(payload)
    .filter((key) => !SIGNATURE_EXCLUDED_KEYS.has(key))
    .sort()
    .map((key) => `${key}=${String(payload[key])}`)
    .join('&');

  return `${sortedParams}&key=${secretKey}`;
}

function generateSignature(
  payload: Record<string, unknown>,
  config: Pick<ShlianluSmsConfig, 'secretKey' | 'signType'>,
) {
  const raw = buildSignatureString(payload, config.secretKey);
  if (config.signType === 'HMACSHA256') {
    return createHmac('sha256', config.secretKey)
      .update(raw, 'utf8')
      .digest('hex')
      .toUpperCase();
  }

  return createHash('md5').update(raw, 'utf8').digest('hex').toUpperCase();
}

function extractProviderTaskId(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const record = payload as Record<string, unknown>;
  return normalizeText(
    record.taskId ||
      record.TaskId ||
      record.task_id ||
      record.messageId ||
      record.message_id ||
      record.id,
  );
}

async function postJson(url: string, body: unknown, headers = {}) {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=utf-8',
      ...headers,
    },
    method: 'POST',
  });
  const responseText = await response.text();
  let payload: unknown = responseText;

  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = responseText;
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${responseText || response.statusText}`,
    );
  }

  return payload;
}

async function sendSms(payload: OutreachDeliveryPayload) {
  const phoneNumber = normalizeText(payload.phoneNumber);
  if (!phoneNumber) {
    throw new Error('短信触达缺少手机号');
  }

  const config = loadSmsConfig();
  const smsPayload: Record<string, unknown> = {
    AppId: config.appId,
    ContextParamSet: [[phoneNumber]],
    MchId: config.mchId,
    SessionContextSet: [payload.content],
    SignName: config.signName,
    SignType: config.signType,
    TimeStamp: Date.now().toString(),
    Type: config.type,
    Version: config.version,
  };
  const signedPayload = {
    ...smsPayload,
    Signature: generateSignature(smsPayload, config),
  };
  const result = await postJson(config.apiHost, signedPayload);

  if (
    result &&
    typeof result === 'object' &&
    'status' in result &&
    normalizeText((result as Record<string, unknown>).status) !== '00'
  ) {
    throw new Error(
      `短信供应商返回错误：${
        normalizeText((result as Record<string, unknown>).message) ||
        normalizeText((result as Record<string, unknown>).status)
      }`,
    );
  }

  return {
    providerResponse: result,
    providerTaskId: extractProviderTaskId(result),
    resultCode: 'SUCCESS',
    resultMessage: '短信发送成功',
    success: true,
  } satisfies OutreachDeliveryResult;
}

async function sendWebhookChannel(
  payload: OutreachDeliveryPayload,
  options: {
    envHeaders?: string;
    envUrl: string;
    resultMessage: string;
  },
) {
  const url = normalizeText(process.env[options.envUrl]);
  if (!url) {
    throw new Error(`缺少触达通道配置：${options.envUrl}`);
  }

  const result = await postJson(
    url,
    {
      channel: payload.channel,
      companyName: payload.companyName,
      contactName: payload.contactName,
      content: payload.content,
      leadId: payload.leadId,
      phoneNumber: payload.phoneNumber,
      subject: payload.subject,
      taskId: payload.taskId,
      templateCode: payload.templateCode,
    },
    options.envHeaders ? readJsonEnv(options.envHeaders) : {},
  );

  return {
    providerResponse: result,
    providerTaskId: extractProviderTaskId(result),
    resultCode: 'SUCCESS',
    resultMessage: options.resultMessage,
    success: true,
  } satisfies OutreachDeliveryResult;
}

async function getWecomAccessToken() {
  if (wecomAccessTokenCache && wecomAccessTokenCache.expiresAt > Date.now()) {
    return wecomAccessTokenCache.token;
  }

  const corpId = getRequiredEnv('WECOM_CORP_ID');
  const corpSecret = getRequiredEnv('WECOM_AGENT_SECRET');
  const searchParams = new URLSearchParams({
    corpid: corpId,
    corpsecret: corpSecret,
  });
  const response = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?${searchParams.toString()}`,
  );
  const result = (await response.json()) as {
    access_token?: string;
    errcode?: number;
    errmsg?: string;
    expires_in?: number;
  };

  if (!response.ok || result.errcode || !result.access_token) {
    throw new Error(
      `企业微信 token 获取失败：${result.errmsg || response.statusText}`,
    );
  }

  wecomAccessTokenCache = {
    expiresAt:
      Date.now() + Math.max((result.expires_in || 7200) - 120, 60) * 1000,
    token: result.access_token,
  };
  return result.access_token;
}

async function sendWecom(payload: OutreachDeliveryPayload) {
  const webhookUrl = normalizeText(process.env.WECOM_WEBHOOK_URL);
  if (webhookUrl) {
    const result = await postJson(webhookUrl, {
      msgtype: 'text',
      text: {
        content: payload.content,
        mentioned_mobile_list: payload.phoneNumber
          ? [normalizeText(payload.phoneNumber)]
          : undefined,
      },
    });
    return {
      providerResponse: result,
      providerTaskId: extractProviderTaskId(result),
      resultCode: 'SUCCESS',
      resultMessage: '企业微信机器人消息已发送',
      success: true,
    } satisfies OutreachDeliveryResult;
  }

  const agentId = Number(getRequiredEnv('WECOM_AGENT_ID'));
  const toUser = normalizeText(process.env.WECOM_TO_USER) || '@all';
  const accessToken = await getWecomAccessToken();
  const searchParams = new URLSearchParams({ access_token: accessToken });
  const result = await postJson(
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?${searchParams.toString()}`,
    {
      agentid: agentId,
      msgtype: 'text',
      safe: 0,
      text: {
        content: payload.content,
      },
      touser: toUser,
    },
  );

  if (
    result &&
    typeof result === 'object' &&
    Number((result as Record<string, unknown>).errcode || 0) !== 0
  ) {
    throw new Error(
      `企业微信返回错误：${normalizeText(
        (result as Record<string, unknown>).errmsg,
      )}`,
    );
  }

  return {
    providerResponse: result,
    providerTaskId: extractProviderTaskId(result),
    resultCode: 'SUCCESS',
    resultMessage: '企业微信应用消息已发送',
    success: true,
  } satisfies OutreachDeliveryResult;
}

export async function deliverOutreachMessage(
  payload: OutreachDeliveryPayload,
): Promise<OutreachDeliveryResult> {
  const channel = normalizeText(payload.channel).toUpperCase();
  if (!payload.content.trim()) {
    throw new Error('触达内容不能为空');
  }

  if (channel === 'SMS') {
    return sendSms(payload);
  }

  if (['QYWX', 'WECHAT', 'WECHAT_WORK', 'WECOM'].includes(channel)) {
    return sendWecom(payload);
  }

  if (channel === 'EMAIL') {
    return sendWebhookChannel(payload, {
      envHeaders: 'OUTREACH_EMAIL_WEBHOOK_HEADERS_JSON',
      envUrl: 'OUTREACH_EMAIL_WEBHOOK_URL',
      resultMessage: '邮件触达请求已提交',
    });
  }

  if (channel === 'CALL' || channel === 'PHONE') {
    return sendWebhookChannel(payload, {
      envHeaders: 'OUTREACH_PHONE_WEBHOOK_HEADERS_JSON',
      envUrl: 'OUTREACH_PHONE_WEBHOOK_URL',
      resultMessage: '电话外呼请求已提交',
    });
  }

  return sendWebhookChannel(payload, {
    envHeaders: 'OUTREACH_GENERIC_WEBHOOK_HEADERS_JSON',
    envUrl: 'OUTREACH_GENERIC_WEBHOOK_URL',
    resultMessage: `${channel} 触达请求已提交`,
  });
}

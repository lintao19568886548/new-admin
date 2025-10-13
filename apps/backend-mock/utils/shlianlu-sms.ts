import { createHash, createHmac } from 'node:crypto';

interface SmsConfig {
  apiHost: string;
  appId: string;
  mchId: string;
  version: string;
  signType: 'HMACSHA256' | 'MD5';
  apiKey: string;
  templateId: string;
  type: string;
}

interface SendLoginCodeParams {
  code: string;
  phoneNumber: string;
  templateParamSet?: string[];
  tag?: string;
  taskTime?: string;
}

function loadConfig(): SmsConfig {
  const apiHost =
    process.env.SMS_API_HOST ||
    'https://apis.shlianlu.com/sms/trade/template/send';
  const appId = process.env.SMS_APP_ID;
  const mchId = process.env.SMS_MCH_ID;
  const version = process.env.SMS_VERSION || '1.1.0';
  const signType = (process.env.SMS_SIGN_TYPE || 'MD5').toUpperCase();
  const apiKey = process.env.SMS_SECRET_KEY;
  const templateId = process.env.SMS_TEMPLATE_ID || '70344760';
  const type = process.env.SMS_TYPE || '3';

  if (!appId) {
    throw new Error('缺少联麓短信 AppId：SMS_APP_ID');
  }
  if (!mchId) {
    throw new Error('缺少联麓短信 MchId：SMS_MCH_ID');
  }
  if (!apiKey) {
    throw new Error('缺少联麓短信密钥：SMS_API_KEY');
  }
  if (!templateId) {
    throw new Error('缺少联麓短信模板 ID：SMS_TEMPLATE_ID');
  }

  if (signType !== 'MD5' && signType !== 'HMACSHA256') {
    throw new Error(`不支持的 SignType：${signType}，仅支持 MD5 或 HMACSHA256`);
  }

  return {
    apiHost,
    appId,
    mchId,
    version,
    signType,
    apiKey,
    templateId,
    type,
  };
}

function buildSignatureString({
  appId,
  mchId,
  signType,
  templateId,
  timeStamp,
  type,
  version,
  apiKey,
}: {
  apiKey: string;
  appId: string;
  mchId: string;
  signType: string;
  templateId: string;
  timeStamp: string;
  type: string;
  version: string;
}) {
  return `AppId=${appId}&MchId=${mchId}&SignType=${signType}&TemplateId=${templateId}&TimeStamp=${timeStamp}&Type=${type}&Version=${version}&key=${apiKey}`;
}

function generateSignature(
  options: Parameters<typeof buildSignatureString>[0],
) {
  const raw = buildSignatureString(options);
  if (options.signType === 'HMACSHA256') {
    return createHmac('sha256', options.apiKey)
      .update(raw, 'utf8')
      .digest('hex')
      .toUpperCase();
  }

  return createHash('md5').update(raw, 'utf8').digest('hex').toUpperCase();
}

export async function sendLoginVerificationCode({
  code,
  phoneNumber,
  templateParamSet,
  tag,
  taskTime,
}: SendLoginCodeParams) {
  const config = loadConfig();
  const timeStamp = Date.now().toString();
  const payload = {
    AppId: config.appId,
    MchId: config.mchId,
    Version: config.version,
    Type: config.type,
    PhoneNumberSet: [phoneNumber],
    TemplateId: config.templateId,
    TemplateParamSet: templateParamSet ?? [code],
    TimeStamp: timeStamp,
    SignType: config.signType,
    Signature: generateSignature({
      appId: config.appId,
      mchId: config.mchId,
      signType: config.signType,
      templateId: config.templateId,
      timeStamp,
      type: config.type,
      version: config.version,
      apiKey: config.apiKey,
    }),
    ...(taskTime ? { TaskTime: taskTime } : {}),
    ...(tag ? { Tag: tag } : {}),
  };

  const response = await fetch(config.apiHost, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `联麓短信请求失败，状态码：${response.status}，响应：${text}`,
    );
  }

  const result = (await response.json()) as {
    message?: string;
    status?: string;
    taskId?: string;
  };

  if (result.status !== '00') {
    throw new Error(
      `联麓短信返回错误：${result.status ?? 'UNKNOWN'} ${
        result.message ?? ''
      }`.trim(),
    );
  }

  return result;
}

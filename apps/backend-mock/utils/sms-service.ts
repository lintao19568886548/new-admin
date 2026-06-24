import CryptoJS from 'crypto-js';
import { useResponseError } from '~/utils/response';

type SmsRawPayload = {
  contextParamSet: string[][];
  sessionContextSet: string[];
};

type SmsTemplatePayload = {
  phoneNumberSet: string[];
  templateId: string;
  templateParamSet: string[];
};

export type SmsTemplateAuditStatus =
  | 'approved'
  | 'not_found'
  | 'pending'
  | 'rejected'
  | 'unknown';

export interface SmsTemplateStatusResult {
  approved: boolean;
  content?: string;
  raw?: unknown;
  refuseReason?: string;
  status: SmsTemplateAuditStatus;
  statusCode: string;
  statusLabel: string;
  templateId: string;
  templateName?: string;
}

function requireSmsConfig() {
  const mchId = process.env.SMS_MCH_ID;
  const appId = process.env.SMS_APP_ID;
  const appKey = process.env.SMS_SECRET_KEY;
  if (!mchId || !appId || !appKey) {
    throw new Error('短信服务配置不完整');
  }
  return { appId, appKey, mchId };
}

function normalizeSmsSignName(value: unknown) {
  const signName = String(value || '东莞市宜租网络科技有限公司')
    .replaceAll(/[【】]/g, '')
    .trim();
  return signName ? `【${signName}】` : '【东莞市宜租网络科技有限公司】';
}

function getProviderErrorMessage(result: unknown) {
  if (!result || typeof result !== 'object') {
    return '';
  }
  const record = result as Record<string, unknown>;
  const status = String(record.status || '').trim();
  const message = String(record.message || '').trim();
  if (!status || status === '00') {
    return '';
  }
  return message ? `${message}（${status}）` : `短信服务错误（${status}）`;
}

function getProductApiVersions() {
  return [
    process.env.SMS_PRODUCT_VERSION,
    process.env.SMS_TEMPLATE_VERSION,
    process.env.SMS_VERSION,
    '1.1.0',
    '1.2.0',
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function buildSignaturePayload(
  params: Record<string, unknown>,
  appKey: string,
) {
  const excludedKeys = new Set([
    'ContextParamSet',
    'PhoneList',
    'PhoneNumberSet',
    'phoneSet',
    'SessionContext',
    'SessionContextSet',
    'Signature',
    'TemplateParamSet',
  ]);
  const sortedParams: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    if (!excludedKeys.has(key)) {
      sortedParams[key] = params[key];
    }
  }

  return `${Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&')}&key=${appKey}`;
}

function signPayload<T extends Record<string, unknown>>(
  payload: T,
  appKey: string,
) {
  return {
    ...payload,
    Signature: CryptoJS.MD5(buildSignaturePayload(payload, appKey))
      .toString()
      .toUpperCase(),
  };
}

function getRecordValue(record: unknown, keys: string[]) {
  if (!record || typeof record !== 'object') {
    return '';
  }
  const object = record as Record<string, unknown>;
  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null) {
      return String(object[key]).trim();
    }
  }
  return '';
}

function getNestedRecord(value: unknown): null | Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const data = record.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  const result = record.result;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return record;
}

export function normalizeSmsTemplateAuditStatus(
  statusCode: unknown,
): SmsTemplateAuditStatus {
  const status = String(statusCode ?? '').trim();
  if (status === '1') {
    return 'approved';
  }
  if (status === '2') {
    return 'pending';
  }
  if (status === '3') {
    return 'rejected';
  }
  if (!status) {
    return 'unknown';
  }
  return 'unknown';
}

export function getSmsTemplateAuditStatusLabel(status: SmsTemplateAuditStatus) {
  if (status === 'approved') {
    return '审核通过';
  }
  if (status === 'pending') {
    return '审核中';
  }
  if (status === 'rejected') {
    return '已驳回';
  }
  if (status === 'not_found') {
    return '未找到';
  }
  return '未知状态';
}

function normalizeSmsTemplateStatusResult(
  templateId: string,
  result: unknown,
): SmsTemplateStatusResult {
  const record = getNestedRecord(result);
  if (!record) {
    return {
      approved: false,
      raw: result,
      status: 'not_found',
      statusCode: '',
      statusLabel: getSmsTemplateAuditStatusLabel('not_found'),
      templateId,
    };
  }

  const statusCode = getRecordValue(record, [
    'status',
    'Status',
    'auditStatus',
    'state',
  ]);
  const status = normalizeSmsTemplateAuditStatus(statusCode);
  const refuseReason =
    status === 'rejected'
      ? getRecordValue(record, ['refuseReason', 'reason', 'remark'])
      : '';
  return {
    approved: status === 'approved',
    content: getRecordValue(record, ['content', 'Content', 'templateContent']),
    raw: result,
    refuseReason,
    status,
    statusCode,
    statusLabel: getSmsTemplateAuditStatusLabel(status),
    templateId,
    templateName: getRecordValue(record, [
      'TemplateName',
      'templateName',
      'name',
    ]),
  };
}

async function postSmsProductApi(
  pathname: string,
  payload: Record<string, unknown>,
) {
  const { appId, appKey, mchId } = requireSmsConfig();
  const smsData = {
    AppId: appId,
    MchId: mchId,
    SignType: 'MD5',
    Signature: '',
    TimeStamp: Math.round(Date.now()).toString(),
    ...payload,
  };
  const signedPayload = signPayload(smsData, appKey);

  const response = await fetch(
    `https://apis.shlianlu.com/sms/product${pathname}`,
    {
      body: JSON.stringify(signedPayload),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=utf-8',
      },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`短信服务响应错误: ${response.status}`);
  }

  const result = await response.json();
  const providerErrorMessage = getProviderErrorMessage(result);
  if (providerErrorMessage) {
    throw new Error(providerErrorMessage);
  }

  return result;
}

export async function getSmsTemplateStatus(templateId: string) {
  const normalizedTemplateId = String(templateId || '').trim();
  if (!normalizedTemplateId) {
    return {
      approved: false,
      status: 'not_found' as const,
      statusCode: '',
      statusLabel: getSmsTemplateAuditStatusLabel('not_found'),
      templateId: normalizedTemplateId,
    };
  }

  let lastError: unknown;
  for (const version of getProductApiVersions()) {
    try {
      const result = await postSmsProductApi('/template/getById', {
        TemplateId: normalizedTemplateId,
        Version: version,
      });
      return normalizeSmsTemplateStatusResult(normalizedTemplateId, result);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('短信模板状态查询失败');
}

export async function sendRawSms(payload: SmsRawPayload) {
  const { appId, appKey, mchId } = requireSmsConfig();
  const smsData = {
    AppId: appId,
    ContextParamSet: payload.contextParamSet,
    MchId: mchId,
    SessionContextSet: payload.sessionContextSet,
    SignName: normalizeSmsSignName(process.env.SMS_SIGN_NAME),
    SignType: 'MD5',
    Signature: '',
    TimeStamp: Math.round(Date.now()).toString(),
    Type: process.env.SMS_RAW_TYPE || '2',
    Version: process.env.SMS_RAW_VERSION || '1.2.0',
  };

  const signedPayload = signPayload(smsData, appKey);

  const response = await fetch(
    'https://apis.shlianlu.com/sms/trade/personal/send',
    {
      body: JSON.stringify(signedPayload),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=utf-8',
      },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`短信服务响应错误: ${response.status}`);
  }

  const result = await response.json();
  const providerErrorMessage = getProviderErrorMessage(result);
  if (providerErrorMessage) {
    throw new Error(providerErrorMessage);
  }

  return result;
}

export async function sendTemplateSms(payload: SmsTemplatePayload) {
  const { appId, appKey, mchId } = requireSmsConfig();
  const smsData = {
    AppId: appId,
    MchId: mchId,
    PhoneNumberSet: payload.phoneNumberSet,
    SignType: 'MD5',
    Signature: '',
    TemplateId: payload.templateId,
    TemplateParamSet: payload.templateParamSet,
    TimeStamp: Math.round(Date.now()).toString(),
    Type: process.env.SMS_TEMPLATE_TYPE || process.env.SMS_TYPE || '3',
    Version:
      process.env.SMS_TEMPLATE_VERSION || process.env.SMS_VERSION || '1.1.0',
  };
  const signedPayload = signPayload(smsData, appKey);

  const response = await fetch(
    process.env.SMS_TEMPLATE_API_HOST ||
      process.env.SMS_API_HOST ||
      'https://apis.shlianlu.com/sms/trade/template/send',
    {
      body: JSON.stringify(signedPayload),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=utf-8',
      },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`短信服务响应错误: ${response.status}`);
  }

  const result = await response.json();
  const providerErrorMessage = getProviderErrorMessage(result);
  if (providerErrorMessage) {
    throw new Error(providerErrorMessage);
  }

  return result;
}

export async function sendPlainSms(params: {
  message: string;
  phoneNumber: string;
}) {
  return sendRawSms({
    contextParamSet: [[params.phoneNumber]],
    sessionContextSet: [params.message],
  });
}

export function smsConfigErrorResponse(error: unknown) {
  const message =
    error instanceof Error && error.message ? error.message : '短信发送失败';
  return useResponseError(message, 500);
}

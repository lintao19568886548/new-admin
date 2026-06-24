import path from 'node:path';
import { fileURLToPath } from 'node:url';

import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

const DEFAULT_ENV_FILE = path.resolve(backendMockDir, '.env');
const DEFAULT_PHONE_NUMBER = '17770113605';
const DEFAULT_RAW_API_HOST =
  'https://apis.shlianlu.com/sms/trade/personal/send';
const DEFAULT_TEMPLATE_API_HOST =
  'https://apis.shlianlu.com/sms/trade/template/send';
const probeCase = {
  key: 'probe',
  title: '测试探针：短信通道短文本',
  text: '测试短信，请忽略。用于验证短信通道是否可达。',
};

const testCases = [
  {
    key: 'payment_reminder',
    title: '测试版本1：缴费费用提醒',
    templateParamSet: [
      '【测试】短信测试租户',
      '2026年6月',
      '12.34',
      '2026-06-05',
    ],
    text: '测试短信，请忽略。租赁费用提醒：短信测试租户您好，您2026年6月租赁费用未结清，待结金额12.34元，请于2026-06-05前完成核对和缴费。',
  },
  {
    key: 'overdue_10',
    title: '测试版本2：逾期费用提醒',
    templateParamSet: ['【测试】短信测试租户', '2026年6月', '12.34', '10天'],
    text: '测试短信，请忽略。租赁费用提醒：短信测试租户您好，您2026年6月租赁费用已超过约定缴费时间10天，待结金额12.34元。',
  },
  {
    key: 'final_30',
    title: '测试版本3：长期未结费用提醒',
    templateParamSet: ['【测试】短信测试租户', '2026年6月', '12.34', '30天'],
    text: '测试短信，请忽略。租赁费用提醒：短信测试租户您好，您2026年6月租赁费用已超过约定缴费时间30天，待结金额12.34元。',
  },
];

function stripWrappingQuotes(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }

  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }

  return text;
}

function parseArgs(argv) {
  const options = {
    apiHost: '',
    bodyMode: 'full',
    caseKey: '',
    channel: 'auto',
    companyName: '',
    envFile: DEFAULT_ENV_FILE,
    help: false,
    phoneNumber: DEFAULT_PHONE_NUMBER,
    send: false,
    templateId: '',
  };

  for (const arg of argv.filter((item) => item !== '--')) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--send') {
      options.send = true;
      continue;
    }

    if (arg === '--dry-run') {
      options.send = false;
      continue;
    }

    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const [, key, value] = match;
    if (key === 'api-host') {
      options.apiHost = stripWrappingQuotes(value);
      continue;
    }

    if (key === 'channel') {
      options.channel = stripWrappingQuotes(value);
      if (!['auto', 'raw', 'template'].includes(options.channel)) {
        throw new Error('--channel must be auto, raw, or template');
      }
      continue;
    }

    if (key === 'body-mode') {
      options.bodyMode = stripWrappingQuotes(value);
      if (!['full', 'neutral', 'summary'].includes(options.bodyMode)) {
        throw new Error('--body-mode must be full, neutral, or summary');
      }
      continue;
    }

    if (key === 'company-name') {
      options.companyName = stripWrappingQuotes(value);
      continue;
    }

    if (key === 'case') {
      options.caseKey = stripWrappingQuotes(value);
      if (
        ![
          'all',
          'final_30',
          'overdue_10',
          'payment_reminder',
          'probe',
        ].includes(options.caseKey)
      ) {
        throw new Error(
          '--case must be probe, payment_reminder, overdue_10, final_30, or all',
        );
      }
      continue;
    }

    if (key === 'env-file') {
      options.envFile = path.resolve(stripWrappingQuotes(value));
      continue;
    }

    if (key === 'phone') {
      options.phoneNumber = stripWrappingQuotes(value).replaceAll(/\D/g, '');
      continue;
    }

    if (key === 'template-id') {
      options.templateId = stripWrappingQuotes(value);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!/^1\d{10}$/.test(options.phoneNumber)) {
    throw new Error('--phone must be a mainland China mobile number');
  }

  return options;
}

function printHelp() {
  console.log(`催收短信测试脚本

默认只预览三条测试短信，不会发送、不查库、不写库。

Usage:
  pnpm -F @vben/backend-mock sms:collection:test
  pnpm -F @vben/backend-mock sms:collection:test -- --send

Options:
  --send                    实际发送三条测试短信
  --dry-run                 只预览，不发送
  --body-mode=full          正文模式：full/summary/neutral，neutral 避开敏感词排查拦截
  --case=all                发送范围：probe/payment_reminder/overdue_10/final_30/all
  --channel=auto            发送通道：auto/template/raw，默认 auto
  --company-name=<企业主体>  从 SMS_COLLECTION_TEMPLATE_ID_MAP 读取该企业三套模板
  --phone=17770113605       接收手机号，默认 17770113605
  --template-id=<id>        指定单个模板 ID，覆盖企业模板映射
  --env-file=<path>         环境变量文件，默认 apps/backend-mock/.env
  --api-host=<url>          短信接口地址，默认按通道读取环境变量或内置地址

模板通道默认按场景读取：
  SMS_COLLECTION_TEMPLATE_ID_MAP.<企业主体>.payment_reminder
  SMS_COLLECTION_TEMPLATE_ID_MAP.<企业主体>.overdue_10
  SMS_COLLECTION_TEMPLATE_ID_MAP.<企业主体>.final_30
`);
}

function maskPhoneNumber(phoneNumber) {
  return phoneNumber.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

function requireSmsConfig() {
  const mchId = process.env.SMS_MCH_ID;
  const appId = process.env.SMS_APP_ID;
  const appKey = process.env.SMS_SECRET_KEY;
  if (!mchId || !appId || !appKey) {
    throw new Error(
      '短信服务配置不完整，请检查 SMS_MCH_ID、SMS_APP_ID、SMS_SECRET_KEY',
    );
  }

  return { appId, appKey, mchId };
}

function normalizeSmsSignName(value) {
  const signName = String(value || '东莞市宜租网络科技有限公司')
    .replaceAll(/[【】]/g, '')
    .trim();
  return signName ? `【${signName}】` : '【东莞市宜租网络科技有限公司】';
}

function buildSignaturePayload(params, appKey) {
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
  const sortedParams = {};

  for (const key of Object.keys(params).sort()) {
    if (!excludedKeys.has(key)) {
      sortedParams[key] = params[key];
    }
  }

  return `${Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&')}&key=${appKey}`;
}

function signPayload(payload, appKey) {
  return {
    ...payload,
    Signature: CryptoJS.MD5(buildSignaturePayload(payload, appKey))
      .toString()
      .toUpperCase(),
  };
}

function getProviderErrorMessage(result) {
  if (!result || typeof result !== 'object') {
    return '';
  }

  const status = String(result.status || '').trim();
  const message = String(result.message || '').trim();
  if (!status || status === '00') {
    return '';
  }

  return message ? `${message}（${status}）` : `短信服务错误（${status}）`;
}

function parseTemplateIdMap() {
  const raw = String(process.env.SMS_COLLECTION_TEMPLATE_ID_MAP || '').trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    throw new Error(
      `SMS_COLLECTION_TEMPLATE_ID_MAP 不是合法 JSON：${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function resolveCompanyName(options, selectedTestCases, templateIdMap) {
  const explicitCompanyName = String(
    options.companyName ||
      process.env.SMS_COLLECTION_TEMPLATE_COMPANY_NAME ||
      '',
  ).trim();
  if (explicitCompanyName) {
    return explicitCompanyName;
  }

  const templateCases = selectedTestCases.filter(
    (item) => item.key !== 'probe',
  );
  const [firstTemplateCase] = templateCases;
  if (!firstTemplateCase) {
    return '';
  }

  const matchedCompany = Object.entries(templateIdMap).find(([, config]) => {
    if (!config || typeof config !== 'object') {
      return false;
    }
    return templateCases.every((item) => String(config[item.key] || '').trim());
  });
  if (matchedCompany) {
    return matchedCompany[0];
  }

  const fallbackCompany = Object.entries(templateIdMap).find(([, config]) => {
    return (
      config &&
      typeof config === 'object' &&
      String(config[firstTemplateCase.key] || '').trim()
    );
  });
  return fallbackCompany?.[0] || '';
}

function getTemplateId(options, caseKey, companyName, templateIdMap) {
  if (options.templateId) {
    return String(options.templateId).trim();
  }

  const companyConfig = templateIdMap[companyName];
  if (!companyConfig || typeof companyConfig !== 'object') {
    return '';
  }

  return String(companyConfig[caseKey] || '').trim();
}

function getTemplateMapEnvName(caseKey, companyName) {
  const normalizedCompanyName = String(companyName || '<企业主体>').trim();
  return `SMS_COLLECTION_TEMPLATE_ID_MAP.${normalizedCompanyName}.${caseKey}`;
}

function getTemplateApiHost(options) {
  return (
    options.apiHost ||
    process.env.SMS_TEMPLATE_API_HOST ||
    process.env.SMS_API_HOST ||
    DEFAULT_TEMPLATE_API_HOST
  );
}

function getRawApiHost(options) {
  return (
    options.apiHost ||
    process.env.SMS_RAW_API_HOST ||
    process.env.SMS_PERSONAL_API_HOST ||
    DEFAULT_RAW_API_HOST
  );
}

function getSelectedTestCases(caseKey) {
  if (!caseKey || caseKey === 'all') {
    return testCases;
  }
  if (caseKey === 'probe') {
    return [probeCase];
  }
  return testCases.filter((item) => item.key === caseKey);
}

function buildSummaryText(item) {
  return `测试短信，请忽略。${item.title}，用于验证催收短信三个版本是否可以下发。`;
}

function buildNeutralText(item) {
  const versionMap = {
    final_30: '模板版本3',
    overdue_10: '模板版本2',
    payment_reminder: '模板版本1',
  };
  return `测试短信，请忽略。${versionMap[item.key] || item.title}，用于短信联调测试。`;
}

function normalizeTestCaseBody(item, bodyMode) {
  if (item.key === 'probe' || bodyMode === 'full') {
    return item;
  }
  if (bodyMode === 'neutral') {
    return {
      ...item,
      text: buildNeutralText(item),
    };
  }
  return {
    ...item,
    text: buildSummaryText(item),
  };
}

function resolveSendChannel(options, selectedTestCases) {
  if (options.channel !== 'auto') {
    return options.channel;
  }

  const templateCases = selectedTestCases.filter(
    (item) => item.key !== 'probe',
  );
  if (templateCases.length > 0) {
    return 'template';
  }

  return 'raw';
}

async function sendRawSms(payload, options) {
  const { appId, appKey, mchId } = requireSmsConfig();
  const smsData = {
    AppId: appId,
    ContextParamSet: [[payload.phoneNumber]],
    MchId: mchId,
    SessionContextSet: [payload.message],
    SignName: normalizeSmsSignName(process.env.SMS_SIGN_NAME),
    SignType: 'MD5',
    Signature: '',
    TimeStamp: Math.round(Date.now()).toString(),
    Type: process.env.SMS_RAW_TYPE || '2',
    Version: process.env.SMS_RAW_VERSION || '1.2.0',
  };
  const signedPayload = signPayload(smsData, appKey);

  const response = await fetch(getRawApiHost(options), {
    body: JSON.stringify(signedPayload),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=utf-8',
    },
    method: 'POST',
  });

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

async function sendTemplateSms(payload, options) {
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

  const response = await fetch(getTemplateApiHost(options), {
    body: JSON.stringify(signedPayload),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=utf-8',
    },
    method: 'POST',
  });

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

function sanitizeProviderResult(value) {
  if (typeof value === 'string') {
    return value.replaceAll(/1\d{10}/g, (phoneNumber) =>
      maskPhoneNumber(phoneNumber),
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeProviderResult(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeProviderResult(item),
      ]),
    );
  }

  return value;
}

function printPreview(
  options,
  sendChannel,
  selectedTestCases,
  companyName,
  templateIdMap,
) {
  console.log(
    JSON.stringify(
      {
        channel: sendChannel,
        companyName: companyName || '(未指定，仅 raw 探针不需要)',
        mode: options.send ? 'send' : 'dry-run',
        note: options.send
          ? '将实际发送三条【测试】催收短信'
          : '仅预览，不发送短信；实际发送请加 --send',
        phoneNumber: maskPhoneNumber(options.phoneNumber),
        tests: selectedTestCases.map((item) => ({
          key: item.key,
          templateParamSet: item.templateParamSet || '(raw-only)',
          templateEnvName:
            item.key === 'probe'
              ? '(raw-only)'
              : getTemplateMapEnvName(item.key, companyName),
          templateId:
            item.key === 'probe'
              ? '(raw-only)'
              : getTemplateId(options, item.key, companyName, templateIdMap) ||
                '(未配置，模板通道发送时必须提供)',
          text: item.text,
          title: item.title,
        })),
      },
      null,
      2,
    ),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  dotenv.config({ path: options.envFile });

  const selectedTestCases = getSelectedTestCases(options.caseKey).map((item) =>
    normalizeTestCaseBody(item, options.bodyMode),
  );
  const templateIdMap = parseTemplateIdMap();
  const companyName = resolveCompanyName(
    options,
    selectedTestCases,
    templateIdMap,
  );
  const sendChannel = resolveSendChannel(
    options,
    selectedTestCases,
    companyName,
    templateIdMap,
  );
  printPreview(
    options,
    sendChannel,
    selectedTestCases,
    companyName,
    templateIdMap,
  );

  if (!options.send) {
    return;
  }

  const results = [];
  for (const item of selectedTestCases) {
    try {
      const templateId = getTemplateId(
        options,
        item.key,
        companyName,
        templateIdMap,
      );
      if (sendChannel === 'template' && !templateId) {
        throw new Error(
          `催收短信模板未配置，请配置 ${getTemplateMapEnvName(
            item.key,
            companyName,
          )} 或传 --template-id`,
        );
      }
      const providerResult =
        sendChannel === 'template'
          ? await sendTemplateSms(
              {
                phoneNumberSet: [options.phoneNumber],
                templateId,
                templateParamSet: item.templateParamSet || [
                  '【测试】短信测试租户',
                  '2026年6月',
                  '12.34',
                  '2026-06-05',
                  '测试短信',
                ],
              },
              options,
            )
          : await sendRawSms(
              {
                message: item.text,
                phoneNumber: options.phoneNumber,
              },
              options,
            );
      results.push({
        channel: sendChannel,
        key: item.key,
        providerResult: sanitizeProviderResult(providerResult),
        success: true,
        title: item.title,
      });
      console.log(`[ok] ${item.title} 已提交发送`);
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : '发送失败';
      results.push({
        channel: sendChannel,
        error: message,
        key: item.key,
        success: false,
        title: item.title,
      });
      console.error(`[failed] ${item.title}: ${message}`);
    }
  }

  const failedCount = results.filter((item) => !item.success).length;
  console.log(JSON.stringify({ results }, null, 2));

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message =
    error instanceof Error && error.message ? error.message : String(error);
  console.error(`[test-collection-sms] failed: ${message}`);
  process.exitCode = 1;
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

const DEFAULT_ENV_FILE = path.resolve(backendMockDir, '.env');
const PRODUCT_API_HOST = 'https://apis.shlianlu.com/sms/product';

const templateCases = [
  {
    content:
      '租赁费用提醒：{%租户%}您好，您{%账期%}租赁费用未结清，待结金额{%金额%}元，请于{%截止日期%}前完成核对和缴费。如已处理请忽略。',
    key: 'payment_reminder',
    name: '租赁费用-缴费提醒',
  },
  {
    content:
      '租赁费用提醒：{%租户%}您好，您{%账期%}租赁费用已超过约定缴费时间{%逾期天数%}，待结金额{%金额%}元，请尽快完成核对和缴费。如已处理请忽略。',
    key: 'overdue_10',
    name: '租赁费用-逾期提醒',
  },
  {
    content:
      '租赁费用提醒：{%租户%}您好，您{%账期%}租赁费用已超过约定缴费时间{%逾期天数%}，待结金额{%金额%}元。请及时联系园区财务核对并完成缴费。如已处理请忽略。',
    key: 'final_30',
    name: '租赁费用-长期未结提醒',
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
    apply: false,
    envFile: DEFAULT_ENV_FILE,
    forceCreate: false,
    help: false,
    signId: '',
    signName: '',
    updateConfigured: false,
  };

  for (const arg of argv.filter((item) => item !== '--')) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    if (arg === '--dry-run') {
      options.apply = false;
      continue;
    }

    if (arg === '--force-create') {
      options.forceCreate = true;
      continue;
    }

    if (arg === '--update-configured') {
      options.updateConfigured = true;
      continue;
    }

    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const [, key, value] = match;
    if (key === 'env-file') {
      options.envFile = path.resolve(stripWrappingQuotes(value));
      continue;
    }

    if (key === 'sign-id') {
      options.signId = stripWrappingQuotes(value);
      continue;
    }

    if (key === 'sign-name') {
      options.signName = stripWrappingQuotes(value);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`联麓催收短信模板报备脚本

默认只查询某个企业签名和模板，不会创建模板。

Usage:
  pnpm -F @vben/backend-mock sms:collection:templates -- --sign-name=东莞市亿胜物业管理有限公司
  pnpm -F @vben/backend-mock sms:collection:templates -- --sign-name=东莞市亿胜物业管理有限公司 --apply

Options:
  --apply             实际提交三条催收模板到联麓审核
  --dry-run           只查询和预览，不创建模板
  --force-create      即使 .env 已配置模板 ID，也重新创建新模板
  --update-configured 更新 .env 中已配置的模板内容并重新送审
  --sign-id=<id>      指定联麓短信签名 ID
  --sign-name=<name>  按签名名称匹配签名 ID，必须是企业主体签名
  --env-file=<path>   环境变量文件，默认 apps/backend-mock/.env

脚本输出的模板 ID 需要写入 SMS_COLLECTION_TEMPLATE_ID_MAP。
`);
}

function normalizeSignText(value) {
  return String(value || '')
    .replaceAll(/[【】]/g, '')
    .trim();
}

function getTemplateMapEnvName(companyName, templateKey) {
  return `SMS_COLLECTION_TEMPLATE_ID_MAP.${companyName}.${templateKey}`;
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

function getConfiguredTemplateId(templateIdMap, companyName, templateKey) {
  const companyConfig = templateIdMap[companyName];
  if (!companyConfig || typeof companyConfig !== 'object') {
    return '';
  }
  return String(companyConfig[templateKey] || '').trim();
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
    const value = params[key];
    if (
      !excludedKeys.has(key) &&
      value !== undefined &&
      value !== null &&
      String(value) !== ''
    ) {
      sortedParams[key] = value;
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

  const status = String(result.status || result.code || '').trim();
  const message = String(result.message || result.msg || '').trim();
  if (!status || status === '00' || status === '0' || status === '200') {
    return '';
  }

  return message ? `${message}（${status}）` : `短信服务错误（${status}）`;
}

async function postProductApi(pathname, payload) {
  const { appKey } = requireSmsConfig();
  const signedPayload = signPayload(payload, appKey);
  const response = await fetch(`${PRODUCT_API_HOST}${pathname}`, {
    body: JSON.stringify(signedPayload),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=utf-8',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`联麓接口响应错误: ${response.status}`);
  }

  const result = await response.json();
  const providerErrorMessage = getProviderErrorMessage(result);
  if (providerErrorMessage) {
    throw new Error(providerErrorMessage);
  }

  return result;
}

async function postProductApiWithVersionFallback(pathname, payload) {
  let lastError;
  for (const version of getProductApiVersions()) {
    try {
      const result = await postProductApi(pathname, {
        ...payload,
        Version: version,
      });
      return { result, version };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('联麓接口请求失败');
}

function listRecords(value) {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const candidates = [
    value.data,
    value.list,
    value.records,
    value.rows,
    value.result,
    value.templateList,
    value.signList,
  ];
  for (const item of candidates) {
    if (Array.isArray(item)) {
      return item;
    }
    if (item && typeof item === 'object') {
      const nested = listRecords(item);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  return [];
}

function firstValue(record, keys) {
  if (!record || typeof record !== 'object') {
    return '';
  }

  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return String(record[key]).trim();
    }
  }

  return '';
}

function resolveTemplateId(result) {
  if (!result || typeof result !== 'object') {
    return '';
  }

  const direct = firstValue(result, [
    'TemplateId',
    'templateId',
    'id',
    'template_id',
  ]);
  if (direct) {
    return direct;
  }

  for (const key of ['data', 'result']) {
    const nested = result[key];
    if (nested && typeof nested === 'object') {
      const nestedValue = resolveTemplateId(nested);
      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return '';
}

function getConfiguredTemplateIds(templateIdMap, companyName) {
  return templateCases
    .map((item) => ({
      envName: getTemplateMapEnvName(companyName, item.key),
      key: item.key,
      templateId: getConfiguredTemplateId(templateIdMap, companyName, item.key),
    }))
    .filter((item) => item.templateId);
}

function sanitizeTemplateRecord(record) {
  const statusCode = firstValue(record, [
    'status',
    'Status',
    'auditStatus',
    'state',
  ]);
  return {
    content: firstValue(record, ['content', 'Content', 'templateContent']),
    id: firstValue(record, ['TemplateId', 'templateId', 'id', 'template_id']),
    name: firstValue(record, ['TemplateName', 'templateName', 'name']),
    refuseReason: firstValue(record, ['refuseReason', 'reason', 'remark']),
    signId: firstValue(record, ['SignId', 'signId', 'sign_id']),
    status: statusCode,
    statusLabel: getTemplateStatusLabel(statusCode),
  };
}

function sanitizeSignRecord(record) {
  const statusCode = firstValue(record, [
    'status',
    'Status',
    'auditStatus',
    'state',
  ]);
  return {
    content: firstValue(record, ['content', 'Content', 'signName', 'SignName']),
    id: firstValue(record, ['SignId', 'signId', 'id', 'sign_id']),
    status: statusCode,
    statusLabel: getTemplateStatusLabel(statusCode),
  };
}

function getTemplateStatusLabel(statusCode) {
  const status = String(statusCode ?? '').trim();
  if (status === '1') {
    return '审核通过';
  }
  if (status === '2') {
    return '审核中';
  }
  if (status === '3') {
    return '已驳回';
  }
  if (!status) {
    return '未知状态';
  }
  return `未知状态(${status})`;
}

function findMatchingTemplate(records, template, signId) {
  const normalizedContent = template.content.replaceAll(/\s/g, '');
  const normalizedName = template.name.replaceAll(/\s/g, '');
  return records.find((record) => {
    const item = sanitizeTemplateRecord(record);
    if (signId && item.signId && item.signId !== signId) {
      return false;
    }
    return (
      item.name.replaceAll(/\s/g, '') === normalizedName ||
      item.content.replaceAll(/\s/g, '') === normalizedContent
    );
  });
}

function selectSignId(records, options) {
  if (options.signId) {
    return options.signId;
  }

  const targetSignName = normalizeSignText(options.signName);
  if (!targetSignName) {
    return '';
  }
  const exactMatch = records.find((record) => {
    const item = sanitizeSignRecord(record);
    return normalizeSignText(item.content) === targetSignName;
  });
  if (exactMatch) {
    return sanitizeSignRecord(exactMatch).id;
  }
  return '';
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  dotenv.config({ path: options.envFile });
  const companyName = normalizeSignText(
    options.signName || process.env.SMS_COLLECTION_TEMPLATE_COMPANY_NAME || '',
  );
  if (!companyName) {
    throw new Error(
      '请传 --sign-name=<企业主体名称>，不要使用个人签名或旧的统一签名变量',
    );
  }

  const templateIdMap = parseTemplateIdMap();
  const { appId, mchId } = requireSmsConfig();
  const basePayload = {
    AppId: appId,
    MchId: mchId,
    SignType: 'MD5',
    Signature: '',
    TimeStamp: Math.round(Date.now()).toString(),
  };

  const { result: signResult, version } =
    await postProductApiWithVersionFallback('/sign/get', basePayload);
  const signRecords = listRecords(signResult);
  const signId = selectSignId(signRecords, {
    ...options,
    signName: companyName,
  });
  if (!signId) {
    throw new Error(
      `未找到企业短信签名：${companyName}。请先在联麓后台确认签名审核通过，或传 --sign-id=<id>`,
    );
  }

  const templateListResult = await postProductApi('/template/get', {
    ...basePayload,
    Version: version,
  });
  const templateRecords = listRecords(templateListResult);
  const configuredTemplateStatuses = [];
  for (const item of getConfiguredTemplateIds(templateIdMap, companyName)) {
    try {
      const result = await postProductApi('/template/getById', {
        ...basePayload,
        TemplateId: item.templateId,
        Version: version,
      });
      configuredTemplateStatuses.push({
        envName: item.envName,
        key: item.key,
        rawStatus: sanitizeTemplateRecord(result.data || result),
        templateId: item.templateId,
      });
    } catch (error) {
      configuredTemplateStatuses.push({
        envName: item.envName,
        error: error instanceof Error ? error.message : String(error),
        key: item.key,
        templateId: item.templateId,
      });
    }
  }
  const existingTemplates = templateCases.map((item) => {
    const match = findMatchingTemplate(templateRecords, item, signId);
    return {
      envName: getTemplateMapEnvName(companyName, item.key),
      configuredTemplateId: getConfiguredTemplateId(
        templateIdMap,
        companyName,
        item.key,
      ),
      key: item.key,
      template: match ? sanitizeTemplateRecord(match) : null,
    };
  });

  printJson({
    apply: options.apply,
    companyName,
    configuredTemplateStatuses,
    existingTemplates,
    signId,
    signList: signRecords.map((record) => sanitizeSignRecord(record)),
    version,
  });

  if (!options.apply) {
    return;
  }

  const createdTemplates = [];
  for (const item of templateCases) {
    const existing = existingTemplates.find(
      (template) => template.key === item.key,
    )?.template;
    const configuredTemplateId = options.forceCreate
      ? ''
      : getConfiguredTemplateId(templateIdMap, companyName, item.key);
    if (configuredTemplateId && options.updateConfigured) {
      const result = await postProductApi('/template/update', {
        ...basePayload,
        SignId: signId,
        TemplateId: configuredTemplateId,
        TemplateName: item.name,
        Version: version,
        content: item.content,
      });
      createdTemplates.push({
        envName: getTemplateMapEnvName(companyName, item.key),
        key: item.key,
        providerResult: result,
        skipped: false,
        templateId: configuredTemplateId,
        updated: true,
      });
      continue;
    }

    if (configuredTemplateId) {
      createdTemplates.push({
        envName: getTemplateMapEnvName(companyName, item.key),
        key: item.key,
        skipped: true,
        templateId: configuredTemplateId,
      });
      continue;
    }

    if (existing?.id) {
      createdTemplates.push({
        envName: getTemplateMapEnvName(companyName, item.key),
        key: item.key,
        skipped: true,
        templateId: existing.id,
      });
      continue;
    }

    const result = await postProductApi('/template/create', {
      ...basePayload,
      TemplateName: item.name,
      SignId: signId,
      Version: version,
      content: item.content,
    });
    createdTemplates.push({
      envName: getTemplateMapEnvName(companyName, item.key),
      key: item.key,
      providerResult: result,
      skipped: false,
      templateId: resolveTemplateId(result),
    });
  }

  printJson({ createdTemplates });
}

main().catch((error) => {
  const message =
    error instanceof Error && error.message ? error.message : String(error);
  console.error(`[setup-collection-sms-templates] failed: ${message}`);
  process.exitCode = 1;
});

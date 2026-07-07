import { createSign, createVerify } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseDotenv } from 'dotenv';

const ALIPAY_GATEWAY_URL = 'https://openapi.alipay.com/gateway.do';
const ALIPAY_SIGN_TYPE = 'RSA2';
const ALIPAY_VERSION = '1.0';
const ALIPAY_FORMAT = 'JSON';
// Alipay OpenAPI expects the charset parameter to be formatted as utf-8.
// eslint-disable-next-line unicorn/text-encoding-identifier-case
const ALIPAY_CHARSET = 'utf-8';
const BACKEND_MOCK_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

type AlipayTradeStatus =
  | 'TRADE_CLOSED'
  | 'TRADE_FINISHED'
  | 'TRADE_SUCCESS'
  | 'WAIT_BUYER_PAY'
  | string;

interface AlipayPayConfig {
  appId: string;
  gatewayUrl: string;
  notifyUrl: string;
  privateKey: string;
  publicKey: string;
  returnUrl?: string;
}

export interface AlipayWapPayInput {
  amountTotal: number;
  attach?: string;
  body?: string;
  notifyUrl?: string;
  outTradeNo: string;
  quitUrl?: string;
  returnUrl?: string;
  subject: string;
}

export interface AlipayWapPayResult {
  outTradeNo: string;
  payUrl: string;
}

export interface AlipayPayOrderStatus {
  amount: {
    currency: 'CNY';
    payerCurrency: 'CNY';
    payerTotal: number;
    total: number;
  };
  appId: string;
  attach: string;
  buyerLogonId: string;
  outTradeNo: string;
  success: boolean;
  successTime: string;
  tradeNo: string;
  tradeState: AlipayTradeStatus;
  tradeStateDesc: string;
}

export interface AlipayNotifyPayload {
  appId: string;
  attach: string;
  buyerLogonId: string;
  gmtPayment: string;
  outTradeNo: string;
  totalAmount: string;
  tradeNo: string;
  tradeStatus: AlipayTradeStatus;
}

export class AlipayRequestError extends Error {
  code?: string;
  subCode?: string;

  constructor(message: string, options: { code?: string; subCode?: string }) {
    super(message);
    this.name = 'AlipayRequestError';
    this.code = options.code;
    this.subCode = options.subCode;
  }
}

let alipayConfigPromise: null | Promise<AlipayPayConfig> = null;
let alipayRuntimeEnvLoaded = false;

function isAlipayRuntimeEnvName(name: string) {
  return name.startsWith('ALIPAY_');
}

function getBackendMockDirCandidates() {
  const cwd = process.cwd();
  return [
    BACKEND_MOCK_DIR,
    resolve(BACKEND_MOCK_DIR, '..'),
    resolve(BACKEND_MOCK_DIR, '../..', 'apps/backend-mock'),
    cwd,
    resolve(cwd, 'apps/backend-mock'),
    resolve(cwd, '../apps/backend-mock'),
    resolve(cwd, '../../apps/backend-mock'),
  ].filter((dir, index, dirs) => dirs.indexOf(dir) === index);
}

function loadAlipayRuntimeEnvFile(fileName: string) {
  for (const dir of getBackendMockDirCandidates()) {
    const envPath = resolve(dir, fileName);
    if (!existsSync(envPath)) {
      continue;
    }

    const parsed = parseDotenv(readFileSync(envPath));
    for (const [name, value] of Object.entries(parsed)) {
      if (isAlipayRuntimeEnvName(name)) {
        process.env[name] = value;
      }
    }
  }
}

function ensureAlipayRuntimeEnvLoaded() {
  if (alipayRuntimeEnvLoaded) {
    return;
  }

  loadAlipayRuntimeEnvFile('.env');
  loadAlipayRuntimeEnvFile('.env.dev');
  loadAlipayRuntimeEnvFile('.env.local');
  alipayRuntimeEnvLoaded = true;
}

function readEnv(name: string) {
  ensureAlipayRuntimeEnvLoaded();
  return process.env[name]?.trim() || '';
}

function resolveAlipayFilePath(filePath: string) {
  if (isAbsolute(filePath)) {
    return filePath;
  }

  const candidates = getBackendMockDirCandidates().map((dir) =>
    resolve(dir, filePath),
  );
  return (
    candidates.find((path) => existsSync(path)) ||
    resolve(BACKEND_MOCK_DIR, filePath)
  );
}

function resolveOptionalFileEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    return {
      exists: false,
      path: '',
    };
  }
  const path = resolveAlipayFilePath(value);
  return {
    exists: existsSync(path),
    path,
  };
}

function getRequiredEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`缺少支付宝环境变量 ${name}`);
  }
  return value;
}

function normalizePem(input: string, type: 'PRIVATE KEY' | 'PUBLIC KEY') {
  const normalized = input.replaceAll(String.raw`\n`, '\n').trim();
  if (normalized.includes('-----BEGIN ')) {
    return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
  }

  const lines = normalized.match(/.{1,64}/g)?.join('\n') || normalized;
  return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----\n`;
}

async function readAlipayPrivateKey() {
  const inlinePrivateKey = readEnv('ALIPAY_PRIVATE_KEY');
  if (inlinePrivateKey) {
    return normalizePem(inlinePrivateKey, 'PRIVATE KEY');
  }

  const privateKeyPath = readEnv('ALIPAY_PRIVATE_KEY_PATH');
  if (!privateKeyPath) {
    throw new Error(
      '缺少支付宝私钥，请设置 ALIPAY_PRIVATE_KEY 或 ALIPAY_PRIVATE_KEY_PATH',
    );
  }

  const privateKey = await readFile(
    resolveAlipayFilePath(privateKeyPath),
    'utf8',
  );
  return normalizePem(privateKey, 'PRIVATE KEY');
}

async function readAlipayPublicKey() {
  const inlinePublicKey = readEnv('ALIPAY_PUBLIC_KEY');
  if (inlinePublicKey) {
    return normalizePem(inlinePublicKey, 'PUBLIC KEY');
  }

  const publicKeyPath = readEnv('ALIPAY_PUBLIC_KEY_PATH');
  if (!publicKeyPath) {
    throw new Error(
      '缺少支付宝公钥，请设置 ALIPAY_PUBLIC_KEY 或 ALIPAY_PUBLIC_KEY_PATH',
    );
  }

  const publicKey = await readFile(
    resolveAlipayFilePath(publicKeyPath),
    'utf8',
  );
  return normalizePem(publicKey, 'PUBLIC KEY');
}

async function loadAlipayConfig(): Promise<AlipayPayConfig> {
  return {
    appId: getRequiredEnv('ALIPAY_APP_ID'),
    gatewayUrl: readEnv('ALIPAY_GATEWAY_URL') || ALIPAY_GATEWAY_URL,
    notifyUrl: getRequiredEnv('ALIPAY_NOTIFY_URL'),
    privateKey: await readAlipayPrivateKey(),
    publicKey: await readAlipayPublicKey(),
    returnUrl: readEnv('ALIPAY_RETURN_URL') || undefined,
  };
}

async function getAlipayConfig() {
  if (!alipayConfigPromise) {
    alipayConfigPromise = loadAlipayConfig();
  }
  return alipayConfigPromise;
}

export function getAlipayPayConfigStatus() {
  const appId = readEnv('ALIPAY_APP_ID');
  const notifyUrl = readEnv('ALIPAY_NOTIFY_URL');
  const missing: string[] = [];

  if (!appId) {
    missing.push('ALIPAY_APP_ID');
  }
  if (!notifyUrl) {
    missing.push('ALIPAY_NOTIFY_URL');
  }
  if (!readEnv('ALIPAY_PRIVATE_KEY') && !readEnv('ALIPAY_PRIVATE_KEY_PATH')) {
    missing.push('ALIPAY_PRIVATE_KEY / ALIPAY_PRIVATE_KEY_PATH');
  }
  if (
    !readEnv('ALIPAY_PRIVATE_KEY') &&
    readEnv('ALIPAY_PRIVATE_KEY_PATH') &&
    !resolveOptionalFileEnv('ALIPAY_PRIVATE_KEY_PATH').exists
  ) {
    missing.push('ALIPAY_PRIVATE_KEY_PATH');
  }
  if (!readEnv('ALIPAY_PUBLIC_KEY') && !readEnv('ALIPAY_PUBLIC_KEY_PATH')) {
    missing.push('ALIPAY_PUBLIC_KEY / ALIPAY_PUBLIC_KEY_PATH');
  }
  if (
    !readEnv('ALIPAY_PUBLIC_KEY') &&
    readEnv('ALIPAY_PUBLIC_KEY_PATH') &&
    !resolveOptionalFileEnv('ALIPAY_PUBLIC_KEY_PATH').exists
  ) {
    missing.push('ALIPAY_PUBLIC_KEY_PATH');
  }

  return {
    appId,
    configured: missing.length === 0,
    gatewayUrl: readEnv('ALIPAY_GATEWAY_URL') || ALIPAY_GATEWAY_URL,
    missing,
  };
}

function formatAlipayTimestamp(date = new Date()) {
  const pad = (value: number) => `${value}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}`;
}

function centsToAlipayAmount(amountTotal: number) {
  return (amountTotal / 100).toFixed(2);
}

function alipayAmountToCents(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return Math.round(amount * 100);
}

function normalizeString(value: unknown) {
  return String(value || '').trim();
}

function buildSignContent(
  params: Record<string, unknown>,
  options: { excludeSignType?: boolean } = {},
) {
  return Object.entries(params)
    .filter(([key, value]) => {
      if (key === 'sign') {
        return false;
      }
      if (options.excludeSignType && key === 'sign_type') {
        return false;
      }
      return value !== undefined && value !== null && String(value) !== '';
    })
    .sort(([firstKey], [secondKey]) => {
      if (firstKey < secondKey) {
        return -1;
      }
      if (firstKey > secondKey) {
        return 1;
      }
      return 0;
    })
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
}

function signAlipayParams(params: Record<string, unknown>, privateKey: string) {
  const signer = createSign('RSA-SHA256');
  signer.update(buildSignContent(params));
  signer.end();
  return signer.sign(privateKey, 'base64');
}

function verifyAlipaySignature(
  content: string,
  signature: string,
  publicKey: string,
) {
  const verifier = createVerify('RSA-SHA256');
  verifier.update(content);
  verifier.end();
  return verifier.verify(publicKey, signature, 'base64');
}

export function verifyAlipayNotifyParams(
  params: Record<string, unknown>,
  publicKey: string,
) {
  const signature = normalizeString(params.sign);
  if (!signature) {
    return false;
  }

  return verifyAlipaySignature(
    buildSignContent(params, { excludeSignType: true }),
    signature,
    publicKey,
  );
}

function buildGatewayParams(
  config: AlipayPayConfig,
  params: {
    bizContent: Record<string, unknown>;
    method: string;
    notifyUrl?: string;
    returnUrl?: string;
  },
) {
  const gatewayParams: Record<string, string> = {
    app_id: config.appId,
    biz_content: JSON.stringify(params.bizContent),
    charset: ALIPAY_CHARSET,
    format: ALIPAY_FORMAT,
    method: params.method,
    sign_type: ALIPAY_SIGN_TYPE,
    timestamp: formatAlipayTimestamp(),
    version: ALIPAY_VERSION,
  };

  if (params.notifyUrl) {
    gatewayParams.notify_url = params.notifyUrl;
  }
  if (params.returnUrl) {
    gatewayParams.return_url = params.returnUrl;
  }

  gatewayParams.sign = signAlipayParams(gatewayParams, config.privateKey);
  return gatewayParams;
}

function buildGatewayUrl(gatewayUrl: string, params: Record<string, string>) {
  const url = new URL(gatewayUrl);
  const searchParams = new URLSearchParams(params);
  url.search = searchParams.toString();
  return url.toString();
}

function appendOutTradeNoToReturnUrl(
  returnUrl: string | undefined,
  outTradeNo: string,
) {
  if (!returnUrl) {
    return undefined;
  }

  try {
    const url = new URL(returnUrl);
    url.searchParams.set('alipayOutTradeNo', outTradeNo);
    return url.toString();
  } catch {
    return returnUrl;
  }
}

export async function createAlipayWapPay(
  payload: AlipayWapPayInput,
): Promise<AlipayWapPayResult> {
  const config = await getAlipayConfig();
  const passbackParams = payload.attach
    ? encodeURIComponent(payload.attach)
    : undefined;
  const params = buildGatewayParams(config, {
    bizContent: {
      body: payload.body || payload.subject,
      out_trade_no: payload.outTradeNo,
      passback_params: passbackParams,
      product_code: 'QUICK_WAP_WAY',
      quit_url: payload.quitUrl,
      subject: payload.subject,
      total_amount: centsToAlipayAmount(payload.amountTotal),
    },
    method: 'alipay.trade.wap.pay',
    notifyUrl: payload.notifyUrl || config.notifyUrl,
    returnUrl: appendOutTradeNoToReturnUrl(
      payload.returnUrl || config.returnUrl,
      payload.outTradeNo,
    ),
  });

  return {
    outTradeNo: payload.outTradeNo,
    payUrl: buildGatewayUrl(config.gatewayUrl, params),
  };
}

function extractResponseSignContent(rawBody: string, responseKey: string) {
  const keyToken = `"${responseKey}"`;
  const keyIndex = rawBody.indexOf(keyToken);
  if (keyIndex === -1) {
    return '';
  }

  const colonIndex = rawBody.indexOf(':', keyIndex + keyToken.length);
  if (colonIndex === -1) {
    return '';
  }

  let objectStart = colonIndex + 1;
  while (/\s/.test(rawBody[objectStart] || '')) {
    objectStart += 1;
  }
  if (rawBody[objectStart] !== '{') {
    return '';
  }

  let depth = 0;
  let escaped = false;
  let inString = false;
  for (let index = objectStart; index < rawBody.length; index += 1) {
    const character = rawBody[index];

    if (inString) {
      escaped = character === '\\' && !escaped;
      if (character === '"' && !escaped) {
        inString = false;
      } else if (character !== '\\') {
        escaped = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') {
      depth += 1;
      continue;
    }
    if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        const responseObject = rawBody.slice(objectStart, index + 1);
        return {
          responseObject,
          responsePair: `${keyToken}:${responseObject}`,
        };
      }
    }
  }

  return '';
}

function verifyAlipayJsonResponse(params: {
  publicKey: string;
  rawBody: string;
  responseKey: string;
  sign?: unknown;
}) {
  const signature = normalizeString(params.sign);
  if (!signature) {
    throw new Error('支付宝响应缺少签名');
  }

  const content = extractResponseSignContent(
    params.rawBody,
    params.responseKey,
  );
  if (!content) {
    throw new Error('支付宝响应验签内容为空');
  }

  const candidates =
    typeof content === 'string'
      ? [content]
      : [content.responsePair, content.responseObject];
  const verified = candidates.some((candidate) =>
    verifyAlipaySignature(candidate, signature, params.publicKey),
  );
  if (!verified) {
    throw new Error('支付宝响应验签失败');
  }
}

async function signedAlipayRequest<T>(
  method: string,
  bizContent: Record<string, unknown>,
  responseKey: string,
) {
  const config = await getAlipayConfig();
  const params = buildGatewayParams(config, {
    bizContent,
    method,
  });
  const response = await fetch(config.gatewayUrl, {
    body: new URLSearchParams(params).toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    method: 'POST',
  });
  const rawBody = await response.text();

  if (!response.ok) {
    throw new AlipayRequestError(`支付宝请求失败，HTTP ${response.status}`, {
      code: `${response.status}`,
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new Error('支付宝响应不是合法 JSON');
  }

  verifyAlipayJsonResponse({
    publicKey: config.publicKey,
    rawBody,
    responseKey,
    sign: payload.sign,
  });

  const result = payload[responseKey] as T | undefined;
  if (!result || typeof result !== 'object') {
    throw new Error('支付宝响应缺少业务结果');
  }

  return result;
}

function normalizeAlipayTradeStateDesc(state: AlipayTradeStatus) {
  if (state === 'TRADE_SUCCESS') {
    return '支付成功';
  }
  if (state === 'TRADE_FINISHED') {
    return '交易完成';
  }
  if (state === 'WAIT_BUYER_PAY') {
    return '等待买家付款';
  }
  if (state === 'TRADE_CLOSED') {
    return '交易关闭';
  }
  return state || '未知状态';
}

export async function queryAlipayPayOrder(
  outTradeNo: string,
): Promise<AlipayPayOrderStatus> {
  const config = await getAlipayConfig();
  const result = await signedAlipayRequest<Record<string, unknown>>(
    'alipay.trade.query',
    {
      out_trade_no: outTradeNo,
    },
    'alipay_trade_query_response',
  );
  const code = normalizeString(result.code);
  if (code !== '10000') {
    throw new AlipayRequestError(
      normalizeString(result.sub_msg) ||
        normalizeString(result.msg) ||
        '支付宝查单失败',
      {
        code,
        subCode: normalizeString(result.sub_code) || undefined,
      },
    );
  }

  const tradeState = normalizeString(result.trade_status) as AlipayTradeStatus;
  const success =
    tradeState === 'TRADE_SUCCESS' || tradeState === 'TRADE_FINISHED';
  const amountTotal = alipayAmountToCents(result.total_amount);

  return {
    amount: {
      currency: 'CNY',
      payerCurrency: 'CNY',
      payerTotal: amountTotal,
      total: amountTotal,
    },
    appId: config.appId,
    attach: '',
    buyerLogonId: normalizeString(result.buyer_logon_id),
    outTradeNo: normalizeString(result.out_trade_no) || outTradeNo,
    success,
    successTime: normalizeString(result.send_pay_date),
    tradeNo: normalizeString(result.trade_no),
    tradeState,
    tradeStateDesc: normalizeAlipayTradeStateDesc(tradeState),
  };
}

export async function parseAndVerifyAlipayNotify(
  params: Record<string, unknown>,
) {
  const config = await getAlipayConfig();
  if (!verifyAlipayNotifyParams(params, config.publicKey)) {
    throw new Error('支付宝异步通知验签失败');
  }

  const passbackParams = normalizeString(params.passback_params);
  return {
    appId: normalizeString(params.app_id),
    attach: passbackParams ? decodeURIComponent(passbackParams) : '',
    buyerLogonId: normalizeString(params.buyer_logon_id),
    gmtPayment: normalizeString(params.gmt_payment),
    outTradeNo: normalizeString(params.out_trade_no),
    totalAmount: normalizeString(params.total_amount),
    tradeNo: normalizeString(params.trade_no),
    tradeStatus: normalizeString(params.trade_status) as AlipayTradeStatus,
  } satisfies AlipayNotifyPayload;
}

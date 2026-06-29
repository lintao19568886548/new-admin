import {
  createDecipheriv,
  createSign,
  createVerify,
  randomUUID,
} from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WECHAT_PAY_API_BASE_URL = 'https://api.mch.weixin.qq.com';
const WECHAT_PAY_ACCEPT_LANGUAGE = 'zh-CN';
const WECHAT_PAY_USER_AGENT = 'vben-admin-backend-mock/1.0';
const WECHAT_PAY_CERT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const BACKEND_MOCK_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

type HttpMethod = 'GET' | 'POST';

interface WechatPayConfig {
  apiBaseUrl: string;
  apiV3Key: string;
  appId: string;
  certSerialNo: string;
  mchId: string;
  notifyUrl: string;
  privateKey: string;
  publicKey?: string;
  publicKeyId?: string;
  userAgent: string;
}

interface WechatPayEncryptResource {
  algorithm: string;
  associated_data?: string;
  ciphertext: string;
  nonce: string;
}

interface WechatPayCertificateItem {
  encrypt_certificate: WechatPayEncryptResource;
  expire_time?: string;
  serial_no: string;
}

interface WechatPayCertificatesResponse {
  data?: WechatPayCertificateItem[];
}

interface WechatPayNotificationPayload {
  create_time?: string;
  event_type?: string;
  id?: string;
  resource?: WechatPayEncryptResource;
  resource_type?: string;
  summary?: string;
}

interface WechatPaySignatureHeaders {
  nonce: string;
  serial: string;
  signature: string;
  timestamp: string;
}

interface WechatPaySignedResponse<T> {
  data: T;
  rawBody: string;
}

interface WechatPayResponseError {
  code?: string;
  detail?: {
    field?: string;
    issue?: string;
    value?: string;
  }[];
  message?: string;
}

interface WechatPayPlatformCertificateCache {
  certificates: Map<string, string>;
  expiresAt: number;
  loadingPromise: null | Promise<Map<string, string>>;
}

export interface WechatAppPrepayInput {
  amount: {
    currency?: string;
    total: number;
  };
  attach?: string;
  description: string;
  deviceId?: string;
  notifyUrl?: string;
  outTradeNo: string;
  payerClientIp?: string;
}

export interface WechatAppLaunchParams {
  appId: string;
  nonceStr: string;
  outTradeNo: string;
  packageValue: 'Sign=WXPay';
  partnerId: string;
  prepayId: string;
  sign: string;
  timeStamp: string;
}

export interface WechatPayOrderStatus {
  amount: {
    currency: string;
    payerCurrency: string;
    payerTotal: number;
    total: number;
  };
  appId: string;
  attach: string;
  bankType: string;
  mchId: string;
  outTradeNo: string;
  success: boolean;
  successTime: string;
  tradeState: string;
  tradeStateDesc: string;
  transactionId: string;
}

export interface WechatPayNotificationResult {
  notification: WechatPayNotificationPayload;
  resource: Record<string, any>;
}

export interface WechatPayRefundInput {
  amount: {
    currency?: string;
    refund: number;
    total: number;
  };
  notifyUrl?: string;
  outRefundNo: string;
  outTradeNo?: string;
  reason?: string;
  transactionId?: string;
}

export interface WechatPayRefundStatus {
  amount: {
    currency: string;
    payerRefund: number;
    payerTotal: number;
    refund: number;
    total: number;
  };
  channel: string;
  createTime: string;
  outRefundNo: string;
  outTradeNo: string;
  refundId: string;
  status: string;
  successTime: string;
  transactionId: string;
  userReceivedAccount: string;
}

const platformCertificateCache: WechatPayPlatformCertificateCache = {
  certificates: new Map<string, string>(),
  expiresAt: 0,
  loadingPromise: null,
};

let wechatPayConfigPromise: null | Promise<WechatPayConfig> = null;

function readEnv(name: string) {
  return process.env[name]?.trim() || '';
}

function hasAnyEnv(names: string[]) {
  return names.some((name) => Boolean(readEnv(name)));
}

function resolveWechatPayFilePath(filePath: string) {
  return isAbsolute(filePath) ? filePath : resolve(BACKEND_MOCK_DIR, filePath);
}

function resolveOptionalFileEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    return {
      exists: false,
      path: '',
    };
  }
  const path = resolveWechatPayFilePath(value);
  return {
    exists: existsSync(path),
    path,
  };
}

function getRequiredEnv(name: string, aliases: string[] = []) {
  const value = [name, ...aliases]
    .map((envName) => readEnv(envName))
    .find(Boolean);
  if (!value) {
    const names = [name, ...aliases].join(' / ');
    throw new Error(`缺少微信支付环境变量 ${names}`);
  }
  return value;
}

export function getWechatPayAppPublicConfig() {
  return {
    appId: getRequiredEnv('WECHAT_OPEN_APP_ID', ['WECHAT_APP_ID']),
    mchId: getRequiredEnv('WECHAT_PAY_MERCHANT_ID'),
  };
}

export function getWechatPayAppConfigStatus() {
  const appId = readEnv('WECHAT_OPEN_APP_ID') || readEnv('WECHAT_APP_ID');
  const mchId = readEnv('WECHAT_PAY_MERCHANT_ID');
  const missing: string[] = [];

  if (!appId) {
    missing.push('WECHAT_OPEN_APP_ID / WECHAT_APP_ID');
  }
  if (!mchId) {
    missing.push('WECHAT_PAY_MERCHANT_ID');
  }
  if (!readEnv('WECHAT_PAY_API_V3_KEY')) {
    missing.push('WECHAT_PAY_API_V3_KEY');
  }
  if (!readEnv('WECHAT_PAY_CERT_SERIAL_NO')) {
    missing.push('WECHAT_PAY_CERT_SERIAL_NO');
  }
  if (!readEnv('WECHAT_PAY_NOTIFY_URL')) {
    missing.push('WECHAT_PAY_NOTIFY_URL');
  }
  if (
    hasAnyEnv([
      'WECHAT_PAY_PUBLIC_KEY',
      'WECHAT_PAY_PUBLIC_KEY_ID',
      'WECHAT_PAY_PUBLIC_KEY_PATH',
    ]) &&
    !readEnv('WECHAT_PAY_PUBLIC_KEY_ID')
  ) {
    missing.push('WECHAT_PAY_PUBLIC_KEY_ID');
  }
  if (
    !readEnv('WECHAT_PAY_PUBLIC_KEY') &&
    readEnv('WECHAT_PAY_PUBLIC_KEY_PATH') &&
    !resolveOptionalFileEnv('WECHAT_PAY_PUBLIC_KEY_PATH').exists
  ) {
    missing.push('WECHAT_PAY_PUBLIC_KEY_PATH');
  }
  if (!hasAnyEnv(['WECHAT_PAY_PRIVATE_KEY', 'WECHAT_PAY_PRIVATE_KEY_PATH'])) {
    missing.push('WECHAT_PAY_PRIVATE_KEY / WECHAT_PAY_PRIVATE_KEY_PATH');
  }
  if (
    !readEnv('WECHAT_PAY_PRIVATE_KEY') &&
    readEnv('WECHAT_PAY_PRIVATE_KEY_PATH') &&
    !resolveOptionalFileEnv('WECHAT_PAY_PRIVATE_KEY_PATH').exists
  ) {
    missing.push('WECHAT_PAY_PRIVATE_KEY_PATH');
  }

  return {
    appId,
    configured: missing.length === 0,
    mchId,
    missing,
  };
}

function normalizePem(input: string) {
  const normalized = input.replaceAll(String.raw`\n`, '\n').trim();
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

async function readWechatPayPrivateKey() {
  const inlinePrivateKey = process.env.WECHAT_PAY_PRIVATE_KEY?.trim();
  if (inlinePrivateKey) {
    return normalizePem(inlinePrivateKey);
  }

  const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH?.trim();
  if (!privateKeyPath) {
    throw new Error(
      '缺少微信支付私钥，请设置 WECHAT_PAY_PRIVATE_KEY 或 WECHAT_PAY_PRIVATE_KEY_PATH',
    );
  }

  const privateKey = await readFile(
    resolveWechatPayFilePath(privateKeyPath),
    'utf8',
  );
  return normalizePem(privateKey);
}

async function readWechatPayPublicKey() {
  const publicKeyId = process.env.WECHAT_PAY_PUBLIC_KEY_ID?.trim();
  const inlinePublicKey = process.env.WECHAT_PAY_PUBLIC_KEY?.trim();
  const publicKeyPath = process.env.WECHAT_PAY_PUBLIC_KEY_PATH?.trim();

  if (!publicKeyId && !inlinePublicKey && !publicKeyPath) {
    return {};
  }

  if (!publicKeyId) {
    throw new Error('缺少微信支付环境变量 WECHAT_PAY_PUBLIC_KEY_ID');
  }

  if (inlinePublicKey) {
    return {
      publicKey: normalizePem(inlinePublicKey),
      publicKeyId,
    };
  }

  if (!publicKeyPath) {
    throw new Error(
      '缺少微信支付公钥，请设置 WECHAT_PAY_PUBLIC_KEY 或 WECHAT_PAY_PUBLIC_KEY_PATH',
    );
  }

  return {
    publicKey: normalizePem(
      await readFile(resolveWechatPayFilePath(publicKeyPath), 'utf8'),
    ),
    publicKeyId,
  };
}

async function loadWechatPayConfig(): Promise<WechatPayConfig> {
  const publicConfig = getWechatPayAppPublicConfig();
  const publicKeyConfig = await readWechatPayPublicKey();

  return {
    apiBaseUrl:
      process.env.WECHAT_PAY_API_BASE_URL?.trim() || WECHAT_PAY_API_BASE_URL,
    apiV3Key: getRequiredEnv('WECHAT_PAY_API_V3_KEY'),
    appId: publicConfig.appId,
    certSerialNo: getRequiredEnv('WECHAT_PAY_CERT_SERIAL_NO'),
    mchId: publicConfig.mchId,
    notifyUrl: getRequiredEnv('WECHAT_PAY_NOTIFY_URL'),
    privateKey: await readWechatPayPrivateKey(),
    ...publicKeyConfig,
    userAgent: process.env.WECHAT_PAY_USER_AGENT || WECHAT_PAY_USER_AGENT,
  };
}

async function getWechatPayConfig() {
  if (!wechatPayConfigPromise) {
    wechatPayConfigPromise = loadWechatPayConfig();
  }
  return wechatPayConfigPromise;
}

function buildWechatPaySignatureMessage(params: {
  body: string;
  method: HttpMethod;
  nonce: string;
  pathWithQuery: string;
  timestamp: string;
}) {
  return `${params.method}\n${params.pathWithQuery}\n${params.timestamp}\n${params.nonce}\n${params.body}\n`;
}

function signWechatPayMessage(message: string, privateKey: string) {
  const signer = createSign('RSA-SHA256');
  signer.update(message);
  signer.end();
  return signer.sign(privateKey, 'base64');
}

function verifyWechatPayMessage(params: {
  message: string;
  publicKey: string;
  signature: string;
}) {
  const verifier = createVerify('RSA-SHA256');
  verifier.update(params.message);
  verifier.end();
  return verifier.verify(params.publicKey, params.signature, 'base64');
}

function buildWechatPayAuthorizationHeader(params: {
  body: string;
  config: WechatPayConfig;
  method: HttpMethod;
  nonce: string;
  pathWithQuery: string;
  timestamp: string;
}) {
  const message = buildWechatPaySignatureMessage({
    body: params.body,
    method: params.method,
    nonce: params.nonce,
    pathWithQuery: params.pathWithQuery,
    timestamp: params.timestamp,
  });
  const signature = signWechatPayMessage(message, params.config.privateKey);

  return `WECHATPAY2-SHA256-RSA2048 mchid="${params.config.mchId}",nonce_str="${params.nonce}",signature="${signature}",timestamp="${params.timestamp}",serial_no="${params.config.certSerialNo}"`;
}

function buildAppLaunchSign(params: {
  appId: string;
  nonceStr: string;
  prepayId: string;
  privateKey: string;
  timeStamp: string;
}) {
  const message = [
    params.appId,
    params.timeStamp,
    params.nonceStr,
    params.prepayId,
    '',
  ].join('\n');
  return signWechatPayMessage(message, params.privateKey);
}

function decryptWechatPayCiphertext(params: {
  apiV3Key: string;
  resource: WechatPayEncryptResource;
}) {
  if (params.resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error(
      `暂不支持的微信支付加密算法 ${params.resource.algorithm || 'unknown'}`,
    );
  }

  const decipherKey = Buffer.from(params.apiV3Key, 'utf8');
  if (decipherKey.length !== 32) {
    throw new Error('WECHAT_PAY_API_V3_KEY 长度必须为 32 字节');
  }

  const encryptedBuffer = Buffer.from(params.resource.ciphertext, 'base64');
  const authTag = encryptedBuffer.subarray(-16);
  const ciphertext = encryptedBuffer.subarray(0, -16);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    decipherKey,
    Buffer.from(params.resource.nonce, 'utf8'),
  );

  if (params.resource.associated_data) {
    decipher.setAAD(Buffer.from(params.resource.associated_data, 'utf8'));
  }

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

function parseWechatPaySignatureHeaders(headers: Headers) {
  const timestamp = headers.get('Wechatpay-Timestamp')?.trim();
  const nonce = headers.get('Wechatpay-Nonce')?.trim();
  const serial = headers.get('Wechatpay-Serial')?.trim();
  const signature = headers.get('Wechatpay-Signature')?.trim();

  if (!timestamp || !nonce || !serial || !signature) {
    throw new Error('微信支付回包缺少必要签名头');
  }

  return {
    nonce,
    serial,
    signature,
    timestamp,
  };
}

function buildIncomingWechatPayMessage(
  headers: WechatPaySignatureHeaders,
  body: string,
) {
  return `${headers.timestamp}\n${headers.nonce}\n${body}\n`;
}

function normalizeRequestBody(body?: null | Record<string, any>) {
  if (!body) {
    return '';
  }
  return JSON.stringify(body);
}

function parseWechatPayResponseBody<T>(rawBody: string) {
  if (!rawBody) {
    return {} as T;
  }

  return JSON.parse(rawBody) as T;
}

function extractWechatPayErrorMessage(
  status: number,
  payload: null | WechatPayResponseError,
) {
  if (!payload) {
    return `微信支付请求失败，HTTP ${status}`;
  }

  if (payload.message) {
    return payload.message;
  }

  if (payload.code) {
    return `微信支付请求失败：${payload.code}`;
  }

  return `微信支付请求失败，HTTP ${status}`;
}

async function fetchWechatPlatformCertificates(forceRefresh = false) {
  const now = Date.now();
  if (
    !forceRefresh &&
    platformCertificateCache.certificates.size > 0 &&
    platformCertificateCache.expiresAt > now
  ) {
    return platformCertificateCache.certificates;
  }

  if (platformCertificateCache.loadingPromise) {
    return platformCertificateCache.loadingPromise;
  }

  const loadingPromise = (async () => {
    const response =
      await signedWechatPayRequest<WechatPayCertificatesResponse>(
        '/v3/certificates',
        {
          method: 'GET',
          skipResponseVerification: true,
        },
      );

    const config = await getWechatPayConfig();
    const certificates = new Map<string, string>();
    const certificateList = response.data.data || [];

    for (const item of certificateList) {
      if (!item.serial_no || !item.encrypt_certificate) {
        continue;
      }

      const pem = decryptWechatPayCiphertext({
        apiV3Key: config.apiV3Key,
        resource: item.encrypt_certificate,
      });
      certificates.set(item.serial_no, pem);
    }

    if (certificates.size === 0) {
      throw new Error('未获取到任何微信支付平台证书');
    }

    platformCertificateCache.certificates = certificates;
    platformCertificateCache.expiresAt =
      Date.now() + WECHAT_PAY_CERT_CACHE_TTL_MS;

    return certificates;
  })();

  platformCertificateCache.loadingPromise = loadingPromise;

  try {
    return await loadingPromise;
  } finally {
    platformCertificateCache.loadingPromise = null;
  }
}

async function verifyWechatPayResponseSignature(params: {
  headers: Headers;
  rawBody: string;
}) {
  const signatureHeaders = parseWechatPaySignatureHeaders(params.headers);
  const config = await getWechatPayConfig();
  let signaturePublicKey: string | undefined;

  if (config.publicKey && signatureHeaders.serial === config.publicKeyId) {
    signaturePublicKey = config.publicKey;
  }

  if (!signaturePublicKey) {
    let certificates = await fetchWechatPlatformCertificates();
    signaturePublicKey = certificates.get(signatureHeaders.serial);

    if (!signaturePublicKey) {
      certificates = await fetchWechatPlatformCertificates(true);
      signaturePublicKey = certificates.get(signatureHeaders.serial);
    }
  }

  if (!signaturePublicKey) {
    throw new Error(
      `未找到序列号为 ${signatureHeaders.serial} 的微信支付验签公钥`,
    );
  }

  const verified = verifyWechatPayMessage({
    message: buildIncomingWechatPayMessage(signatureHeaders, params.rawBody),
    publicKey: signaturePublicKey,
    signature: signatureHeaders.signature,
  });

  if (!verified) {
    throw new Error('微信支付回包验签失败');
  }
}

async function signedWechatPayRequest<T>(
  pathWithQuery: string,
  options: {
    body?: null | Record<string, any>;
    method: HttpMethod;
    skipResponseVerification?: boolean;
  },
): Promise<WechatPaySignedResponse<T>> {
  const config = await getWechatPayConfig();
  const body = normalizeRequestBody(options.body);
  const nonce = randomUUID().replaceAll('-', '');
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const authorization = buildWechatPayAuthorizationHeader({
    body,
    config,
    method: options.method,
    nonce,
    pathWithQuery,
    timestamp,
  });
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': WECHAT_PAY_ACCEPT_LANGUAGE,
    Authorization: authorization,
    'Content-Type': 'application/json',
    'User-Agent': config.userAgent,
  };

  if (config.publicKeyId) {
    headers['Wechatpay-Serial'] = config.publicKeyId;
  }

  const response = await fetch(`${config.apiBaseUrl}${pathWithQuery}`, {
    body: options.method === 'POST' ? body : undefined,
    headers,
    method: options.method,
  });
  const rawBody = await response.text();

  if (!options.skipResponseVerification) {
    await verifyWechatPayResponseSignature({
      headers: response.headers,
      rawBody,
    });
  }

  if (!response.ok) {
    let errorPayload: null | WechatPayResponseError = null;
    try {
      errorPayload = rawBody
        ? (JSON.parse(rawBody) as WechatPayResponseError)
        : null;
    } catch {
      errorPayload = null;
    }

    throw new Error(
      extractWechatPayErrorMessage(response.status, errorPayload),
    );
  }

  return {
    data: parseWechatPayResponseBody<T>(rawBody),
    rawBody,
  };
}

export async function createWechatAppPrepay(
  payload: WechatAppPrepayInput,
): Promise<{
  launchParams: WechatAppLaunchParams;
  prepayId: string;
}> {
  const config = await getWechatPayConfig();
  const requestBody: Record<string, any> = {
    amount: {
      currency: payload.amount.currency || 'CNY',
      total: payload.amount.total,
    },
    appid: config.appId,
    attach: payload.attach || undefined,
    description: payload.description,
    mchid: config.mchId,
    notify_url: payload.notifyUrl || config.notifyUrl,
    out_trade_no: payload.outTradeNo,
    scene_info: {
      device_id: payload.deviceId || undefined,
      payer_client_ip: payload.payerClientIp || '127.0.0.1',
    },
  };

  if (!requestBody.scene_info.device_id) {
    delete requestBody.scene_info.device_id;
  }

  const response = await signedWechatPayRequest<{ prepay_id: string }>(
    '/v3/pay/transactions/app',
    {
      body: requestBody,
      method: 'POST',
    },
  );

  const packageValue = 'Sign=WXPay' as const;
  const nonceStr = randomUUID().replaceAll('-', '');
  const timeStamp = `${Math.floor(Date.now() / 1000)}`;
  const prepayId = response.data.prepay_id;

  return {
    launchParams: {
      appId: config.appId,
      nonceStr,
      outTradeNo: payload.outTradeNo,
      packageValue,
      partnerId: config.mchId,
      prepayId,
      sign: buildAppLaunchSign({
        appId: config.appId,
        nonceStr,
        prepayId,
        privateKey: config.privateKey,
        timeStamp,
      }),
      timeStamp,
    },
    prepayId,
  };
}

export async function queryWechatPayOrder(outTradeNo: string) {
  const config = await getWechatPayConfig();
  const response = await signedWechatPayRequest<Record<string, any>>(
    `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(config.mchId)}`,
    {
      method: 'GET',
    },
  );

  const amount = response.data.amount || {};

  return {
    amount: {
      currency: String(amount.currency || 'CNY'),
      payerCurrency: String(amount.payer_currency || 'CNY'),
      payerTotal: Number(amount.payer_total || 0),
      total: Number(amount.total || 0),
    },
    appId: String(response.data.appid || config.appId),
    attach: String(response.data.attach || ''),
    bankType: String(response.data.bank_type || ''),
    mchId: String(response.data.mchid || config.mchId),
    outTradeNo: String(response.data.out_trade_no || outTradeNo),
    success: String(response.data.trade_state || '') === 'SUCCESS',
    successTime: String(response.data.success_time || ''),
    tradeState: String(response.data.trade_state || ''),
    tradeStateDesc: String(response.data.trade_state_desc || ''),
    transactionId: String(response.data.transaction_id || ''),
  } satisfies WechatPayOrderStatus;
}

function normalizeWechatRefundStatus(
  payload: Record<string, any>,
  fallbackOutRefundNo: string,
): WechatPayRefundStatus {
  const amount = payload.amount || {};
  return {
    amount: {
      currency: String(amount.currency || 'CNY'),
      payerRefund: Number(amount.payer_refund || 0),
      payerTotal: Number(amount.payer_total || 0),
      refund: Number(amount.refund || 0),
      total: Number(amount.total || 0),
    },
    channel: String(payload.channel || ''),
    createTime: String(payload.create_time || ''),
    outRefundNo: String(payload.out_refund_no || fallbackOutRefundNo),
    outTradeNo: String(payload.out_trade_no || ''),
    refundId: String(payload.refund_id || ''),
    status: String(payload.status || ''),
    successTime: String(payload.success_time || ''),
    transactionId: String(payload.transaction_id || ''),
    userReceivedAccount: String(payload.user_received_account || ''),
  };
}

export async function createWechatPayRefund(input: WechatPayRefundInput) {
  const config = await getWechatPayConfig();
  const requestBody: Record<string, any> = {
    amount: {
      currency: input.amount.currency || 'CNY',
      refund: input.amount.refund,
      total: input.amount.total,
    },
    notify_url: input.notifyUrl || config.notifyUrl,
    out_refund_no: input.outRefundNo,
    out_trade_no: input.transactionId ? undefined : input.outTradeNo,
    reason: input.reason || undefined,
    transaction_id: input.transactionId || undefined,
  };

  if (!requestBody.out_trade_no) {
    delete requestBody.out_trade_no;
  }
  if (!requestBody.transaction_id) {
    delete requestBody.transaction_id;
  }
  if (!requestBody.reason) {
    delete requestBody.reason;
  }

  const response = await signedWechatPayRequest<Record<string, any>>(
    '/v3/refund/domestic/refunds',
    {
      body: requestBody,
      method: 'POST',
    },
  );

  return normalizeWechatRefundStatus(response.data, input.outRefundNo);
}

export async function queryWechatPayRefund(outRefundNo: string) {
  const response = await signedWechatPayRequest<Record<string, any>>(
    `/v3/refund/domestic/refunds/${encodeURIComponent(outRefundNo)}`,
    {
      method: 'GET',
    },
  );

  return normalizeWechatRefundStatus(response.data, outRefundNo);
}

export async function verifyAndDecryptWechatPayNotification(params: {
  rawBody: string;
  signatureHeaders: WechatPaySignatureHeaders;
}) {
  const config = await getWechatPayConfig();
  let signaturePublicKey: string | undefined;

  if (
    config.publicKey &&
    params.signatureHeaders.serial === config.publicKeyId
  ) {
    signaturePublicKey = config.publicKey;
  }

  if (!signaturePublicKey) {
    const certificates = await fetchWechatPlatformCertificates();
    signaturePublicKey = certificates.get(params.signatureHeaders.serial);

    if (!signaturePublicKey) {
      const refreshedCertificates = await fetchWechatPlatformCertificates(true);
      signaturePublicKey = refreshedCertificates.get(
        params.signatureHeaders.serial,
      );
    }
  }

  if (!signaturePublicKey) {
    throw new Error(
      `未找到序列号为 ${params.signatureHeaders.serial} 的微信支付验签公钥`,
    );
  }

  const verified = verifyWechatPayMessage({
    message: buildIncomingWechatPayMessage(
      params.signatureHeaders,
      params.rawBody,
    ),
    publicKey: signaturePublicKey,
    signature: params.signatureHeaders.signature,
  });

  if (!verified) {
    throw new Error('微信支付回调验签失败');
  }

  const notification = JSON.parse(
    params.rawBody,
  ) as WechatPayNotificationPayload;
  const resource = notification.resource;
  if (!resource) {
    throw new Error('微信支付回调缺少 resource 字段');
  }

  const decryptedResource = decryptWechatPayCiphertext({
    apiV3Key: config.apiV3Key,
    resource,
  });

  return {
    notification,
    resource: JSON.parse(decryptedResource) as Record<string, any>,
  } satisfies WechatPayNotificationResult;
}

export function resolveWechatPaySignatureHeaders(input: {
  nonce?: null | string;
  serial?: null | string;
  signature?: null | string;
  timestamp?: null | string;
}) {
  const nonce = String(input.nonce || '').trim();
  const serial = String(input.serial || '').trim();
  const signature = String(input.signature || '').trim();
  const timestamp = String(input.timestamp || '').trim();

  if (!nonce || !serial || !signature || !timestamp) {
    throw new Error('微信支付回调请求头不完整');
  }

  return {
    nonce,
    serial,
    signature,
    timestamp,
  } satisfies WechatPaySignatureHeaders;
}

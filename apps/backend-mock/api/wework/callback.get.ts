import { createDecipheriv, createHash } from 'node:crypto';

import { serverErrorResponse } from '~/utils/response';

function sha1Sorted(values: string[]) {
  return createHash('sha1').update(values.sort().join('')).digest('hex');
}

function verifyCallbackSignature(query: Record<string, any>, token: string) {
  const timestamp = String(query.timestamp || '');
  const nonce = String(query.nonce || '');
  const echostr = String(query.echostr || '');
  const signature = String(query.signature || query.msg_signature || '');

  if (!token || !timestamp || !nonce || !echostr || !signature) {
    return false;
  }

  return sha1Sorted([token, timestamp, nonce, echostr]) === signature;
}

function decryptWeworkEcho(echostr: string) {
  const aesKey = String(process.env.WEWORK_CALLBACK_AES_KEY || '').trim();
  if (!aesKey) {
    return echostr;
  }
  const key = Buffer.from(`${aesKey}=`, 'base64');
  if (key.length !== 32) {
    throw new Error('企业微信回调 EncodingAESKey 不合法');
  }

  const encrypted = Buffer.from(echostr, 'base64');
  const decipher = createDecipheriv('aes-256-cbc', key, key.subarray(0, 16));
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  const pad = decrypted.at(-1) || 0;
  const plain = decrypted.subarray(0, decrypted.length - pad);
  const messageLength = plain.readUInt32BE(16);
  return plain.subarray(20, 20 + messageLength).toString('utf8');
}

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const echostr = String(query.echostr || '');
  const token = String(process.env.WEWORK_CALLBACK_TOKEN || '').trim();

  if (!echostr) {
    return serverErrorResponse('缺少 echostr', event, 400);
  }

  if (token && !verifyCallbackSignature(query, token)) {
    return serverErrorResponse('企业微信回调签名校验失败', event, 403);
  }

  try {
    return decryptWeworkEcho(echostr);
  } catch (error) {
    console.error('[wework] decrypt callback echo failed:', error);
    return serverErrorResponse('企业微信回调验证解密失败', event, 500);
  }
});

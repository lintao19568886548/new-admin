import { createDecipheriv, createHash } from 'node:crypto';

import { recordCrmExternalContactEvent } from '~/utils/crm-scrm';
import { serverErrorResponse } from '~/utils/response';

function sha1Sorted(values: string[]) {
  return createHash('sha1').update(values.sort().join('')).digest('hex');
}

function extractXmlTag(raw: string, tagName: string) {
  const pattern = new RegExp(
    `<${tagName}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>|<${tagName}>([\\s\\S]*?)</${tagName}>`,
    'i',
  );
  const matched = raw.match(pattern);
  return (matched?.[1] || matched?.[2] || '').trim();
}

function decryptWeworkXml(encryptedPayload: string) {
  const aesKey = String(process.env.WEWORK_CALLBACK_AES_KEY || '').trim();
  if (!aesKey) {
    return '';
  }
  const key = Buffer.from(`${aesKey}=`, 'base64');
  if (key.length !== 32) {
    throw new Error('企业微信回调 EncodingAESKey 不合法');
  }

  const encrypted = Buffer.from(encryptedPayload, 'base64');
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

function verifyPlainSignature(query: Record<string, any>, token: string) {
  const timestamp = String(query.timestamp || '');
  const nonce = String(query.nonce || '');
  const signature = String(query.signature || '');

  if (!token || !timestamp || !nonce || !signature) {
    return false;
  }

  return sha1Sorted([token, timestamp, nonce]) === signature;
}

function verifyEncryptedSignature(
  query: Record<string, any>,
  token: string,
  encryptedPayload: string,
) {
  const timestamp = String(query.timestamp || '');
  const nonce = String(query.nonce || '');
  const signature = String(query.msg_signature || '');

  if (!token || !timestamp || !nonce || !signature || !encryptedPayload) {
    return false;
  }

  return sha1Sorted([token, timestamp, nonce, encryptedPayload]) === signature;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const token = String(process.env.WEWORK_CALLBACK_TOKEN || '').trim();
  const rawBody = (await readRawBody(event)) || '';
  const encryptedPayload = extractXmlTag(rawBody, 'Encrypt');

  if (token) {
    const signatureOk = encryptedPayload
      ? verifyEncryptedSignature(query, token, encryptedPayload)
      : verifyPlainSignature(query, token);
    if (!signatureOk) {
      return serverErrorResponse('企业微信回调签名校验失败', event, 403);
    }
  }

  let plainBody = rawBody;
  if (encryptedPayload) {
    try {
      plainBody = decryptWeworkXml(encryptedPayload);
    } catch (error) {
      console.error('[wework] decrypt callback failed:', error);
      return serverErrorResponse('企业微信回调解密失败', event, 500);
    }
  }

  const eventType = extractXmlTag(plainBody, 'Event');
  const changeType = extractXmlTag(plainBody, 'ChangeType');
  const externalUserId = extractXmlTag(plainBody, 'ExternalUserID');
  const weworkUserId = extractXmlTag(plainBody, 'UserID');
  const state = extractXmlTag(plainBody, 'State');
  const welcomeCode = extractXmlTag(plainBody, 'WelcomeCode');

  try {
    await recordCrmExternalContactEvent({
      changeType,
      eventType,
      externalUserId,
      rawPayload: {
        encrypted: Boolean(encryptedPayload),
        plainBody,
        query,
        rawBody,
      },
      state,
      welcomeCode,
      weworkUserId,
    });
  } catch (error) {
    console.error('[wework] record callback failed:', error);
    return serverErrorResponse('企业微信回调记录失败', event, 500);
  }

  return 'success';
});

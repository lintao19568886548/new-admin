import { createHash, randomUUID } from 'node:crypto';

import {
  badRequestResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';

interface WechatAccessTokenResponse {
  access_token?: string;
  errcode?: number;
  errmsg?: string;
  expires_in?: number;
}

interface WechatJsApiTicketResponse {
  errcode?: number;
  errmsg?: string;
  expires_in?: number;
  ticket?: string;
}

type WechatCacheState = {
  accessToken: null | string;
  accessTokenExpiresAt: number;
  jsApiTicket: null | string;
  jsApiTicketExpiresAt: number;
};

const cacheState: WechatCacheState =
  (globalThis as any).__wechatJsSdkCache__ ??
  ((globalThis as any).__wechatJsSdkCache__ = {
    accessToken: null,
    accessTokenExpiresAt: 0,
    jsApiTicket: null,
    jsApiTicketExpiresAt: 0,
  });

function isTicketStillValid(expiresAt: number) {
  return expiresAt > Date.now() + 60_000;
}

async function requestWechatAccessToken(appId: string, appSecret: string) {
  if (
    cacheState.accessToken &&
    isTicketStillValid(cacheState.accessTokenExpiresAt)
  ) {
    return cacheState.accessToken;
  }

  const searchParams = new URLSearchParams({
    appid: appId,
    grant_type: 'client_credential',
    secret: appSecret,
  });

  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?${searchParams.toString()}`,
  );
  const payload = (await response.json()) as WechatAccessTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(
      `获取 access_token 失败: ${payload.errmsg || response.statusText || 'unknown error'}`,
    );
  }

  cacheState.accessToken = payload.access_token;
  cacheState.accessTokenExpiresAt =
    Date.now() + Math.max((payload.expires_in ?? 7200) - 120, 60) * 1000;

  return payload.access_token;
}

async function requestWechatJsApiTicket(appId: string, appSecret: string) {
  if (
    cacheState.jsApiTicket &&
    isTicketStillValid(cacheState.jsApiTicketExpiresAt)
  ) {
    return cacheState.jsApiTicket;
  }

  const accessToken = await requestWechatAccessToken(appId, appSecret);
  const searchParams = new URLSearchParams({
    access_token: accessToken,
    type: 'jsapi',
  });

  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/ticket/getticket?${searchParams.toString()}`,
  );
  const payload = (await response.json()) as WechatJsApiTicketResponse;

  if (!response.ok || payload.errcode || !payload.ticket) {
    throw new Error(
      `获取 jsapi_ticket 失败: ${payload.errmsg || response.statusText || 'unknown error'}`,
    );
  }

  cacheState.jsApiTicket = payload.ticket;
  cacheState.jsApiTicketExpiresAt =
    Date.now() + Math.max((payload.expires_in ?? 7200) - 120, 60) * 1000;

  return payload.ticket;
}

function buildWechatSignature(
  ticket: string,
  nonceStr: string,
  timestamp: number,
  url: string,
) {
  const raw = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  return createHash('sha1').update(raw).digest('hex');
}

export default defineEventHandler(async (event) => {
  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  const debugMode = String(getQuery(event).debug || '').trim() === '1';
  const rawUrl = String(getQuery(event).url || '').trim();

  if (!appId || !appSecret) {
    return useResponseSuccess({
      enabled: false,
      reason: 'wechat-js-sdk-not-configured',
    });
  }

  if (!rawUrl) {
    return badRequestResponse('缺少 url 参数', event);
  }

  let normalizedUrl: URL;
  try {
    normalizedUrl = new URL(rawUrl);
  } catch {
    return badRequestResponse('url 参数格式无效', event);
  }

  if (!['http:', 'https:'].includes(normalizedUrl.protocol)) {
    return badRequestResponse('url 协议无效', event);
  }

  normalizedUrl.hash = '';

  try {
    const nonceStr = randomUUID().replaceAll('-', '').slice(0, 16);
    const timestamp = Math.floor(Date.now() / 1000);
    const ticket = await requestWechatJsApiTicket(appId, appSecret);
    const signature = buildWechatSignature(
      ticket,
      nonceStr,
      timestamp,
      normalizedUrl.toString(),
    );

    return useResponseSuccess({
      appId,
      enabled: true,
      nonceStr,
      signature,
      timestamp,
    });
  } catch (error) {
    console.error('生成微信 JS-SDK 配置失败:', error);
    const debugMessage =
      error instanceof Error ? error.message : '生成微信 JS-SDK 配置失败';
    return serverErrorResponse(
      debugMode ? debugMessage : '生成微信 JS-SDK 配置失败',
      event,
    );
  }
});

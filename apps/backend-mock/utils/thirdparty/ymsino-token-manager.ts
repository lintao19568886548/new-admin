/**
 * ============================================================================
 * utils/thirdparty/ymsino-token-manager.ts
 * 亿玛系统 Token 管理器（注意：函数名加了 ymsino 前缀，避免和 hezhong 的自动导入冲突）
 * ============================================================================
 *
 * 存放位置：apps/backend-mock/utils/thirdparty/ymsino-token-manager.ts
 * ============================================================================
 */

import type { AxiosRequestConfig } from 'axios';

import { ymsinoHttp, ymsinoLogin } from './ymsino';

type TokenRecord = { expiresAt: number; token: string };

const refreshLeewayMs = Number(
  process.env.TP_YMSINO_REFRESH_LEEWAY_MS || 600_000,
);

let current: null | TokenRecord = null;
let refreshing: null | Promise<TokenRecord> = null;

function isValid(record: null | TokenRecord) {
  if (!record) return false;
  return record.expiresAt - Date.now() > refreshLeewayMs;
}

async function refresh(): Promise<TokenRecord> {
  const data = await ymsinoLogin();
  const expiresAt = Date.now() + 86_400_000;
  const record = { token: data.Token || '', expiresAt };
  current = record;
  return record;
}

export async function getYmsinoToken(): Promise<string> {
  if (isValid(current)) return current?.token;
  if (!refreshing) {
    refreshing = refresh().finally(() => {
      refreshing = null;
    });
  }
  const record = await refreshing;
  return record.token;
}

export function invalidateYmsinoToken() {
  current = null;
}

export async function ymsinoRequest<T = any>(config: AxiosRequestConfig) {
  const token = await getYmsinoToken();
  const headers = {
    ...config.headers,
    Token: token,
  };
  async function refreshAndRetry() {
    invalidateYmsinoToken();
    const newToken = await getYmsinoToken();
    const retry = await ymsinoHttp.request<T>({
      ...config,
      headers: { ...config.headers, Token: newToken },
    });
    return retry.data;
  }
  try {
    const res = await ymsinoHttp.request<T>({ ...config, headers });
    const data = res.data as any;
    if (data?.Code === '0' || data?.Code === 0) {
      const msg = data?.Msg || '';
      if (
        msg.includes('鉴权') ||
        msg.includes('token') ||
        msg.includes('Token')
      ) {
        return await refreshAndRetry();
      }
    }
    return data;
  } catch (error: any) {
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      return await refreshAndRetry();
    }
    throw error;
  }
}

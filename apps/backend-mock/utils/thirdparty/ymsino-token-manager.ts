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
  if (!data?.Token) {
    throw new Error(data?.Msg || 'Ymsino token response missing Token');
  }

  const expiresAt = Date.now() + 86_400_000;
  const record = { expiresAt, token: data.Token };
  current = record;
  return record;
}

export async function getYmsinoToken(): Promise<string> {
  if (isValid(current)) return current.token;
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
    const msg = String(data?.Msg || '');

    if (
      (data?.Code === '0' || data?.Code === 0) &&
      isYmsinoAuthFailureMessage(msg)
    ) {
      return await refreshAndRetry();
    }

    return data;
  } catch (error: any) {
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      return await refreshAndRetry();
    }
    throw error;
  }
}

function isYmsinoAuthFailureMessage(message: string) {
  return ['鉴权', '授权', '认证', 'token', 'Token'].some((keyword) =>
    message.includes(keyword),
  );
}

import type { AxiosRequestConfig } from 'axios';

import { http, login } from './hezhong';

type TokenRecord = { expiresAt: number; token: string };

// const headerKey = process.env.TP_TOKEN_HEADER_KEY || 'Authorization';
// const headerPrefix = process.env.TP_TOKEN_PREFIX ?? 'Bearer ';
const refreshLeewayMs = Number(
  process.env.TP_TOKEN_REFRESH_LEEWAY_MS || 120_000,
);

let current: null | TokenRecord = null;
let refreshing: null | Promise<TokenRecord> = null;

function isValid(record: null | TokenRecord) {
  if (!record) return false;
  return record.expiresAt - Date.now() > refreshLeewayMs;
}

async function refresh(): Promise<TokenRecord> {
  const data = await login();
  const expiresAt = Date.now() + Number(data.expire) * 1000;
  const record = { token: data.token, expiresAt };
  current = record;
  return record;
}

export async function getToken(): Promise<string> {
  if (isValid(current)) return current?.token;
  if (!refreshing) {
    refreshing = refresh().finally(() => {
      refreshing = null;
    });
  }
  const record = await refreshing;
  return record.token;
}

export function invalidateToken() {
  current = null;
}

export async function request<T = any>(config: AxiosRequestConfig) {
  const token = await getToken();
  const headers = {
    ...config.headers,
    token,
  };
  async function refreshAndRetry() {
    invalidateToken();
    const newToken = await getToken();
    const retryHeaders = { ...config.headers, token: newToken };
    const retryRes = await http.request<T>({
      ...config,
      headers: retryHeaders,
    });
    return retryRes.data;
  }
  const res = await http.request<T>({ ...config, headers });
  const data: any = res.data;
  if (data && typeof data === 'object') {
    const c = data.code;
    if (c === 401 || c === 403) return await refreshAndRetry();
  }
  return data;
}

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

export type SmartServiceRole = 'assistant' | 'system' | 'user';

export interface SmartServiceMessage {
  content: string;
  role: SmartServiceRole;
}

export interface SmartServiceStreamOptions {
  messages: SmartServiceMessage[];
  model?: string;
  signal?: AbortSignal;
}

class SmartServiceRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SmartServiceRequestError';
    this.status = status;
  }
}

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function resolveSmartServiceUrl() {
  const base = apiURL || '/api';
  return `${base.replace(/\/$/, '')}/smart-service/chat`;
}

function extractSseErrorMessage(text: string) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const normalized = line.trimStart();
    if (!normalized.startsWith('data:')) {
      continue;
    }
    const data = normalized.slice(5).trim();
    if (!data || data === '[DONE]') {
      continue;
    }

    try {
      const payload = JSON.parse(data);
      const message = payload?.error?.message || payload?.message;
      if (message) {
        return String(message);
      }
    } catch {
      // Non-JSON SSE chunks are ignored while extracting the error summary.
    }
  }

  return '';
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('json')) {
    const payload = await response.json().catch(() => null);
    return (
      payload?.message ||
      payload?.error?.message ||
      payload?.error ||
      response.statusText ||
      '智能客服请求失败'
    );
  }

  const text = await response.text().catch(() => '');
  return (
    extractSseErrorMessage(text) ||
    text ||
    response.statusText ||
    '智能客服请求失败'
  );
}

export async function requestSmartServiceStream({
  messages,
  model = 'qwen-plus',
  signal,
}: SmartServiceStreamOptions) {
  const accessStore = useAccessStore();
  const headers: Record<string, string> = {
    'Accept-Language': preferences.app.locale,
    'Content-Type': 'application/json',
  };

  if (accessStore.accessToken) {
    headers.Authorization = `Bearer ${accessStore.accessToken}`;
  }

  const response = await fetch(resolveSmartServiceUrl(), {
    body: JSON.stringify({
      messages,
      model,
      stream: true,
    }),
    headers,
    method: 'POST',
    signal,
  });

  if (!response.ok) {
    throw new SmartServiceRequestError(
      await readErrorMessage(response),
      response.status,
    );
  }

  if (!response.body) {
    throw new Error('智能客服未返回响应内容');
  }

  return response;
}

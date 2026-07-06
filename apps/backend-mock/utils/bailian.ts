import axios from 'axios';
import { systemDbClient } from '~/utils/db';

const BAILIAN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen3.5-plus';
const BAILIAN_KEY_NAME = 'ALIYUN_BAILIAN_KEY';
const BAILIAN_KEY_CACHE_TTL_MS = 60_000;
const BAILIAN_CHAT_TIMEOUT_MS = Number(
  process.env.BAILIAN_CHAT_TIMEOUT_MS || 90_000,
);

type BailianMessageContentPart =
  | {
      image_url: { url: string };
      type: 'image_url';
    }
  | {
      text: string;
      type: 'text';
    };

export interface BailianChatMessage {
  content: BailianMessageContentPart[] | string;
  role: 'assistant' | 'system' | 'user';
}

interface RequestBailianChatOptions {
  maxTokens?: number;
  messages: BailianChatMessage[];
  model?: string;
  responseFormat?: Record<string, any>;
  temperature?: number;
  timeoutMs?: number;
}

interface RequestBailianChatStreamOptions extends Omit<
  RequestBailianChatOptions,
  'responseFormat'
> {
  signal?: AbortSignal;
}

interface UploadBailianFileOptions {
  contentType?: string;
  data: Uint8Array;
  filename: string;
  purpose?: string;
}

export interface BailianFileObject {
  bytes?: number;
  created_at?: number;
  filename?: string;
  id: string;
  object?: string;
  purpose?: string;
  status?: string;
}

let bailianApiKeyCache: null | {
  expiresAt: number;
  value: string;
} = null;

function normalizeBailianKey(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw.trim();
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== 'string') {
        continue;
      }
      const key = item.trim();
      if (key) {
        return key;
      }
    }
  }

  return '';
}

async function ensureBailianApiKey() {
  const now = Date.now();
  if (bailianApiKeyCache && bailianApiKeyCache.expiresAt > now) {
    return bailianApiKeyCache.value;
  }

  const envKey = normalizeBailianKey(process.env[BAILIAN_KEY_NAME]);
  let dbKey = '';

  try {
    const record = await systemDbClient.systemKey.findUnique({
      where: {
        key: BAILIAN_KEY_NAME,
      },
    });
    dbKey = normalizeBailianKey(record?.value);
  } catch (error) {
    if (!envKey) {
      throw error;
    }
    console.warn('[bailian] failed to read system key, using env fallback');
  }

  const key = envKey || dbKey;
  if (!key) {
    throw new Error('ALIYUN_BAILIAN_KEY is not configured');
  }

  bailianApiKeyCache = {
    expiresAt: now + BAILIAN_KEY_CACHE_TTL_MS,
    value: key,
  };

  return key;
}

function buildBailianErrorMessage(
  payload: any,
  fallback = 'Bailian request failed',
) {
  return (
    payload?.error?.message || payload?.message || payload?.msg || fallback
  );
}

function buildBailianChatPayload({
  maxTokens,
  messages,
  model = DEFAULT_MODEL,
  responseFormat,
  stream,
  temperature = 0,
}: RequestBailianChatOptions & { stream?: boolean }) {
  const payload: Record<string, any> = {
    messages,
    model,
    temperature,
  };

  if (stream) {
    payload.stream = true;
  }

  if (typeof maxTokens === 'number') {
    payload.max_tokens = maxTokens;
  }

  if (responseFormat) {
    payload.response_format = responseFormat;
  }

  return payload;
}

async function requestBailianFileApi(
  path: string,
  init: RequestInit,
  fallbackMessage: string,
) {
  const apiKey = await ensureBailianApiKey();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${apiKey}`);

  const response = await fetch(`${BAILIAN_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      buildBailianErrorMessage(payload, response.statusText || fallbackMessage),
    );
  }

  return payload as BailianFileObject;
}

export async function uploadBailianFile({
  contentType = 'application/octet-stream',
  data,
  filename,
  purpose = 'file-extract',
}: UploadBailianFileOptions) {
  const formData = new FormData();
  const fileBuffer = Buffer.from(data);
  formData.set('purpose', purpose);
  formData.set('file', new Blob([fileBuffer], { type: contentType }), filename);

  return requestBailianFileApi(
    '/files',
    {
      body: formData,
      method: 'POST',
    },
    'Failed to upload file to Bailian',
  );
}

export async function retrieveBailianFile(fileId: string) {
  return requestBailianFileApi(
    `/files/${encodeURIComponent(fileId)}`,
    {
      method: 'GET',
    },
    'Failed to retrieve Bailian file status',
  );
}

export async function deleteBailianFile(fileId: string) {
  try {
    await requestBailianFileApi(
      `/files/${encodeURIComponent(fileId)}`,
      {
        method: 'DELETE',
      },
      'Failed to delete Bailian file',
    );
  } catch (error) {
    console.warn('[bailian] failed to delete file:', error);
  }
}

export async function requestBailianChat({
  maxTokens,
  messages,
  model = DEFAULT_MODEL,
  responseFormat,
  temperature = 0,
  timeoutMs,
}: RequestBailianChatOptions) {
  const apiKey = await ensureBailianApiKey();
  const payload = buildBailianChatPayload({
    maxTokens,
    messages,
    model,
    responseFormat,
    temperature,
  });

  const response = await axios.post(
    `${BAILIAN_BASE_URL}/chat/completions`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: timeoutMs ?? BAILIAN_CHAT_TIMEOUT_MS,
    },
  );
  return response.data;
}

export async function requestBailianChatStream({
  maxTokens,
  messages,
  model = DEFAULT_MODEL,
  signal,
  temperature = 0.3,
}: RequestBailianChatStreamOptions) {
  const apiKey = await ensureBailianApiKey();
  const response = await fetch(`${BAILIAN_BASE_URL}/chat/completions`, {
    body: JSON.stringify(
      buildBailianChatPayload({
        maxTokens,
        messages,
        model,
        stream: true,
        temperature,
      }),
    ),
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      buildBailianErrorMessage(payload, response.statusText || '请求百炼失败'),
    );
  }

  if (!response.body) {
    throw new Error('百炼接口未返回流式内容');
  }

  return response;
}

export function getContentText(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof content?.text === 'string') return content.text;
  return '';
}

export function extractJsonText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\r?\n([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }
  return text.trim();
}

export function parseBailianJson<T>(responseData: any): null | T {
  const content = getContentText(responseData?.choices?.[0]?.message?.content);
  const jsonText = extractJsonText(content);
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText) as T;
  } catch (error) {
    console.warn('Failed to parse Bailian JSON response:', error);
    return null;
  }
}

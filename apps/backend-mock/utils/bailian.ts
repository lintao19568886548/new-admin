import axios from 'axios';

const BAILIAN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen3.5-plus';

type BailianMessageContentPart =
  | {
      image_url: { url: string };
      type: 'image_url';
    }
  | {
      text: string;
      type: 'text';
    };

interface BailianChatMessage {
  content: BailianMessageContentPart[] | string;
  role: 'assistant' | 'system' | 'user';
}

interface RequestBailianChatOptions {
  maxTokens?: number;
  messages: BailianChatMessage[];
  model?: string;
  temperature?: number;
}

function ensureBailianApiKey() {
  const key = process.env.ALIYUN_BAILIAN_KEY;
  if (!key) {
    throw new Error('ALIYUN_BAILIAN_KEY 未配置');
  }
  return key;
}

export async function requestBailianChat({
  maxTokens = 400,
  messages,
  model = DEFAULT_MODEL,
  temperature = 0,
}: RequestBailianChatOptions) {
  const apiKey = ensureBailianApiKey();
  const response = await axios.post(
    `${BAILIAN_BASE_URL}/chat/completions`,
    {
      max_tokens: maxTokens,
      messages,
      model,
      temperature,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );
  return response.data;
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
    console.warn('百炼返回 JSON 解析失败:', error);
    return null;
  }
}

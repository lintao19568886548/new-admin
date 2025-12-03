import OpenAI from 'openai';

export interface TenantLlmResult {
  address?: string;
  area?: number | string;
  contractDate?: string | { end?: string; start?: string };
  phoneNumber?: string;
  rent?: number | string;
  tenantName?: string;
}

const MODEL = 'qwen3-vl-plus';
const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

/**
 * 将 Blob/File 转换为 data URL
 */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result as string));
    reader.addEventListener('error', (err) => reject(err));
    reader.readAsDataURL(file);
  });
}

/**
 * 将远程图片地址转换为 data URL，便于传给多模态接口
 */
async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return fileToDataUrl(blob);
}

/**
 * 统一处理上传组件文件列表，提取 data URL
 */
export async function filesToDataUrls(files: any[]): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    if (!file) continue;
    if (file.originFileObj) {
      urls.push(await fileToDataUrl(file.originFileObj));
      continue;
    }
    if (
      typeof file.thumbUrl === 'string' &&
      file.thumbUrl.startsWith('data:')
    ) {
      urls.push(file.thumbUrl);
      continue;
    }
    if (typeof file.url === 'string') {
      urls.push(await urlToDataUrl(file.url));
      continue;
    }
  }

  return urls.filter(Boolean);
}

function ensureApiKey() {
  const key = import.meta.env.ALIYUN_BAILIAN_KEY;
  if (!key) {
    throw new Error('ALIYUN_BAILIAN_KEY 未配置');
  }
  return key;
}

function getContentText(content: any): string {
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

function extractJsonText(text: string): string {
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

function tryParseJson(text: string): null | TenantLlmResult {
  if (!text) return null;
  try {
    return JSON.parse(text) as TenantLlmResult;
  } catch (error) {
    console.warn('LLM 返回解析失败，原始内容：', text, error);
    return null;
  }
}

export async function analyzeTenantImages(
  dataUrls: string[],
): Promise<null | TenantLlmResult> {
  if (!dataUrls || dataUrls.length === 0) return null;

  const apiKey = ensureApiKey();
  const client = new OpenAI({
    apiKey,
    baseURL: BASE_URL,
    dangerouslyAllowBrowser: true,
  });

  const prompt = `
请从图片中提取合同关键信息，返回 JSON，字段为：
{
  "tenantName": "合同人姓名",
  "phoneNumber": "合同人手机号，仅数字",
  "contractDate": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"},
  "address": "租赁地点/地址",
  "rent": "租金，数字",
  "area": "出租面积，数字，单位不需要"
}
如果缺失字段，用空值或空对象字段表示，不要写成0或添加额外文字。`;

  const imageParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] =
    dataUrls.map((url) => ({
      image_url: { url },
      type: 'image_url' as const,
    }));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      content: '你是一个帮助提取合同字段的助手，只返回规范 JSON。',
      role: 'system',
    },
    {
      content: [
        { text: prompt, type: 'text' as const },
        ...imageParts,
      ] as OpenAI.Chat.Completions.ChatCompletionContentPart[],
      role: 'user',
    },
  ];

  const completion = await client.chat.completions.create({
    max_tokens: 400,
    messages,
    model: MODEL,
    temperature: 0,
  });

  const content = getContentText(completion.choices?.[0]?.message?.content);
  const jsonText = extractJsonText(content);
  return tryParseJson(jsonText);
}

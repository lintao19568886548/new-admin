import { requestClient } from '#/api/request';

const AI_REQUEST_TIMEOUT_MS = 120_000;

export interface TenantLlmResult {
  address?: string;
  area?: number | string;
  contractDate?: string | { end?: string; start?: string };
  phoneNumber?: string;
  rent?: number | string;
  tenantName?: string;
}

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

export async function analyzeTenantImages(
  dataUrls: string[],
): Promise<null | TenantLlmResult> {
  if (!dataUrls || dataUrls.length === 0) return null;
  return requestClient.post(
    '/llm/tenant-images',
    {
      dataUrls,
    },
    {
      timeout: AI_REQUEST_TIMEOUT_MS,
    },
  );
}

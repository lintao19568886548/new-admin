import { parseBailianJson, requestBailianChat } from '~/utils/bailian';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

interface TenantLlmResult {
  address?: string;
  area?: number | string;
  contractDate?: string | { end?: string; start?: string };
  phoneNumber?: string;
  rent?: number | string;
  tenantName?: string;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as {
    dataUrls?: string[];
  };

  const rawUrls = Array.isArray(body.dataUrls) ? body.dataUrls : [];
  const dataUrls = rawUrls
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 8);

  if (dataUrls.length === 0) {
    return badRequestResponse('没有可识别的图片', event);
  }

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

  try {
    const requestStartedAt = Date.now();
    const totalDataUrlLength = dataUrls.reduce(
      (sum, item) => sum + item.length,
      0,
    );
    console.info('[llm][tenant-images] request start', {
      imageCount: dataUrls.length,
      maxTokens: 300,
      totalDataUrlLength,
    });

    const completion = await requestBailianChat({
      maxTokens: 300,
      messages: [
        {
          content: '你是一个帮助提取合同字段的助手，只返回规范 JSON。',
          role: 'system',
        },
        {
          content: [
            { text: prompt, type: 'text' },
            ...dataUrls.map((url) => ({
              image_url: { url },
              type: 'image_url' as const,
            })),
          ],
          role: 'user',
        },
      ],
      temperature: 0,
    });

    const result = parseBailianJson<TenantLlmResult>(completion);
    console.info('[llm][tenant-images] request done', {
      durationMs: Date.now() - requestStartedAt,
      hasResult: Boolean(result),
    });
    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('租户图片 AI 识别失败:', error?.response?.data || error);
    const message =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      '图片识别失败';
    return serverErrorResponse(message, event);
  }
});

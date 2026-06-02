import { getPublicCrawlerSourceByCode } from '~/utils/investment-radar/crawler-source-repository';
import { seedCrawlerTaskItems } from '~/utils/investment-radar/crawler-task-item-repository';
import { PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES } from '~/utils/investment-radar/crawler-types';
import { getPublicCrawlerAdapter } from '~/utils/investment-radar/public-crawler-adapters';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

const MAX_IMPORT_URL_COUNT = 5000;
const DEFAULT_MAX_RETRY_COUNT = 3;

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function extractUrlsFromText(text: string) {
  const urls: string[] = [];
  const urlPattern = /https?:\/\/[^\s"'<>，,；;]+/gi;
  for (const match of text.matchAll(urlPattern)) {
    urls.push(match[0]);
  }
  return urls;
}

function extractInputUrls(body: Record<string, unknown>) {
  const rawItems: string[] = [];
  const urls = Array.isArray(body.urls) ? body.urls : [];
  for (const item of urls) {
    const text = String(item || '').trim();
    if (!text) {
      continue;
    }
    const extracted = extractUrlsFromText(text);
    rawItems.push(...(extracted.length > 0 ? extracted : [text]));
  }
  rawItems.push(...extractUrlsFromText(String(body.urlText || '')));
  return rawItems;
}

function normalizeImportUrl(value: string) {
  const rawUrl = String(value || '')
    .trim()
    .replaceAll(/[)）\]】,，.。;；]+$/g, '');
  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    if (url.username || url.password) {
      return null;
    }
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeSourceCode(value: unknown) {
  return String(value || '').trim();
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
    string,
    unknown
  >;
  const sourceCode = normalizeSourceCode(body.sourceCode);
  if (!sourceCode) {
    return badRequestResponse('采集平台不能为空', event);
  }
  if (!PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.includes(sourceCode as any)) {
    return badRequestResponse('采集平台不属于公开房源/公开需求范围', event);
  }

  const rawUrls = extractInputUrls(body);
  if (rawUrls.length === 0) {
    return badRequestResponse('URL 列表不能为空', event);
  }
  if (rawUrls.length > MAX_IMPORT_URL_COUNT) {
    return badRequestResponse(
      `单次最多导入 ${MAX_IMPORT_URL_COUNT} 个 URL`,
      event,
    );
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      const source = await getPublicCrawlerSourceByCode(sourceCode);
      const adapter = getPublicCrawlerAdapter(sourceCode);
      if (!source || !adapter) {
        return null;
      }

      const seen = new Set<string>();
      const acceptedUrls: string[] = [];
      const rejectedItems: Array<{
        index: number;
        reason: string;
        sourceUrl: string;
      }> = [];
      let duplicateInputCount = 0;

      rawUrls.forEach((rawUrl, index) => {
        const sourceUrl = normalizeImportUrl(rawUrl);
        if (!sourceUrl) {
          rejectedItems.push({
            index,
            reason: 'URL_INVALID',
            sourceUrl: rawUrl,
          });
          return;
        }
        if (seen.has(sourceUrl)) {
          duplicateInputCount += 1;
          return;
        }
        seen.add(sourceUrl);

        const policyFailureReason = adapter.validateDetailUrl(
          sourceUrl,
          source,
        );
        if (policyFailureReason) {
          rejectedItems.push({
            index,
            reason: policyFailureReason,
            sourceUrl,
          });
          return;
        }
        acceptedUrls.push(sourceUrl);
      });

      const maxRetryCount = clampInt(
        body.maxRetryCount,
        DEFAULT_MAX_RETRY_COUNT,
        1,
        10,
      );
      const seedResult = await seedCrawlerTaskItems(
        acceptedUrls.map((sourceUrl) => ({
          forcePending: body.requeueExisting !== false,
          maxRetryCount,
          sourceId: source.sourceId,
          sourceRefType: 'manual_url_import',
          sourceUrl,
        })),
      );

      return {
        acceptedCount: acceptedUrls.length,
        acceptedUrls,
        duplicateInputCount,
        opportunityType: adapter.opportunityType,
        rejectedCount: rejectedItems.length,
        rejectedItems,
        seed: seedResult,
        source: {
          enabled: source.enabled,
          sourceCode: source.sourceCode,
          sourceId: source.sourceId,
          sourceName: source.sourceName,
        },
        sourceCode,
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        totalInputCount: rawUrls.length,
      };
    });

    if (!result) {
      return badRequestResponse('采集平台不存在或未注册适配器', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('import public opportunity urls failed:', error);
    return serverErrorResponse('批量导入公开采集 URL 失败', event);
  }
});

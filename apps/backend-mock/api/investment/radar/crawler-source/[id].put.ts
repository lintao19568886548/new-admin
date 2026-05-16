import {
  CrawlerSourceValidationError,
  updateCrawlerSource,
} from '~/utils/investment-radar/crawler-source-repository';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

const allowedFields = new Set([
  'allowedPathsJson',
  'blockedPathsJson',
  'crawlIntervalMinutes',
  'enabled',
  'keywordExcludeJson',
  'keywordIncludeJson',
  'rateLimitPerMinute',
  'regionScopeJson',
  'robotsUrl',
]);

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const sourceId = Number(event.context.params?.id);
  if (!Number.isFinite(sourceId) || sourceId <= 0) {
    return badRequestResponse('sourceId 无效', event);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
    string,
    unknown
  >;
  const rejectedField = Object.keys(body).find(
    (key) => !allowedFields.has(key),
  );
  if (rejectedField) {
    return badRequestResponse(`不允许更新字段：${rejectedField}`, event);
  }

  try {
    const result = await runWithRadarSharedScope(() =>
      updateCrawlerSource(sourceId, body),
    );
    if (!result) {
      return badRequestResponse('采集数据源不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof CrawlerSourceValidationError) {
      return badRequestResponse(error.message, event);
    }
    console.error('update crawler source failed:', error);
    return serverErrorResponse('更新采集数据源失败', event);
  }
});

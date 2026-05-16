import {
  getCrawlerSourceById,
  getPublicCrawlerSourceByCode,
  getPublicOpportunityCrawlerSource,
} from '~/utils/investment-radar/crawler-source-repository';
import { requeueCrawlerTaskItems } from '~/utils/investment-radar/crawler-task-item-repository';
import { PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE } from '~/utils/investment-radar/crawler-types';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
    string,
    unknown
  >;

  try {
    const result = await runWithRadarSharedScope(async () => {
      const sourceId = Number(body.sourceId || 0);
      const sourceCode = String(
        body.sourceCode || PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
      ).trim();
      let source;
      if (sourceId > 0) {
        source = await getCrawlerSourceById(sourceId);
      } else if (sourceCode) {
        source = await getPublicCrawlerSourceByCode(sourceCode);
      } else {
        source = await getPublicOpportunityCrawlerSource();
      }
      if (!source) {
        return null;
      }
      const itemIds = Array.isArray(body.itemIds)
        ? body.itemIds.map(Number)
        : [];
      const statuses = Array.isArray(body.statuses)
        ? body.statuses.map(String)
        : undefined;
      return requeueCrawlerTaskItems({
        itemIds,
        sourceId: source.sourceId,
        statuses,
      });
    });
    if (!result) {
      return badRequestResponse('99cfw 采集数据源不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('requeue crawler task items failed:', error);
    return serverErrorResponse('重新入队采集 URL 失败', event);
  }
});

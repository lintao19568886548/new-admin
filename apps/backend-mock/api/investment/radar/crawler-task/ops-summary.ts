import {
  getCrawlerSourceById,
  getPublicCrawlerSourceByCode,
  getPublicOpportunityCrawlerSource,
} from '~/utils/investment-radar/crawler-source-repository';
import { getCrawlerOpsSummary } from '~/utils/investment-radar/crawler-task-repository';
import { PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE } from '~/utils/investment-radar/crawler-types';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);

  try {
    const result = await runWithRadarSharedScope(async () => {
      const sourceId = Number(query.sourceId || 0);
      const sourceCode = String(
        query.sourceCode || PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
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
        return {
          itemStatus: {},
          latestFailedItems: [],
          latestTask: null,
          scheduler: {
            active: false,
            canRunNow: false,
            enabled: false,
            envEnabled: false,
            intervalMs: 0,
            lastError: null,
            lastSkipReason: null,
            lastTaskId: null,
            lastTickFinishedAt: null,
            lastTickStartedAt: null,
            nextRunAt: null,
            reason: 'SOURCE_NOT_FOUND',
            running: false,
            startedAt: null,
            stoppedAt: null,
          },
          source: null,
          taskStatus: {},
        };
      }
      return getCrawlerOpsSummary(source.sourceId);
    });
    return useResponseSuccess(result);
  } catch (error) {
    console.error('get crawler ops summary failed:', error);
    return serverErrorResponse('获取采集运维摘要失败', event);
  }
});

import { CrawlerTaskValidationError } from '~/utils/investment-radar/crawler-task-repository';
import { runPublicOpportunityUrlCrawlerTask } from '~/utils/investment-radar/public-opportunity-url-crawler';
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
    const result = await runWithRadarSharedScope(() =>
      runPublicOpportunityUrlCrawlerTask({
        batchSize: body.batchSize === undefined ? 20 : Number(body.batchSize),
        discoverList:
          body.discoverList === undefined
            ? undefined
            : Boolean(body.discoverList),
        freshnessDays:
          body.freshnessDays === undefined
            ? undefined
            : Number(body.freshnessDays),
        maxRetryCount:
          body.maxRetryCount === undefined
            ? undefined
            : Number(body.maxRetryCount),
        retryDelayMinutes:
          body.retryDelayMinutes === undefined
            ? undefined
            : Number(body.retryDelayMinutes),
        sourceCode:
          body.sourceCode === undefined ? undefined : String(body.sourceCode),
      }),
    );
    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof CrawlerTaskValidationError) {
      return badRequestResponse(error.message, event);
    }
    console.error('run public opportunity crawler task failed:', error);
    return serverErrorResponse('运行公开机会 URL 采集任务失败', event);
  }
});

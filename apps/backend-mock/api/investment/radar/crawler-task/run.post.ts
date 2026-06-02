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
        batchSize: body.batchSize === undefined ? 10 : Number(body.batchSize),
        discoverList:
          body.discoverList === undefined ? true : Boolean(body.discoverList),
        freshnessDays:
          body.freshnessDays === undefined ? 180 : Number(body.freshnessDays),
        ignoreInterval:
          body.ignoreInterval === undefined
            ? true
            : Boolean(body.ignoreInterval),
        maxListPages:
          body.maxListPages === undefined ? 5 : Number(body.maxListPages),
        maxRetryCount:
          body.maxRetryCount === undefined
            ? undefined
            : Number(body.maxRetryCount),
        staleReprocessMinutes:
          body.staleReprocessMinutes === undefined
            ? 24 * 60
            : Number(body.staleReprocessMinutes),
        sourceCode:
          body.sourceCode === undefined ? undefined : String(body.sourceCode),
      }),
    );
    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof CrawlerTaskValidationError) {
      return badRequestResponse(error.message, event);
    }
    console.error('run crawler task failed:', error);
    return serverErrorResponse('运行采集任务失败', event);
  }
});

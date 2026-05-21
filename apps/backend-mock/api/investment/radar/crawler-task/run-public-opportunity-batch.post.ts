import { CrawlerTaskValidationError } from '~/utils/investment-radar/crawler-task-repository';
import { runPublicOpportunityBatchCrawler } from '~/utils/investment-radar/public-opportunity-batch-runner';
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
      runPublicOpportunityBatchCrawler({
        batchSize: body.batchSize === undefined ? 500 : Number(body.batchSize),
        continueOnError:
          body.continueOnError === undefined
            ? undefined
            : Boolean(body.continueOnError),
        discoverList:
          body.discoverList === undefined
            ? undefined
            : Boolean(body.discoverList),
        freshnessDays:
          body.freshnessDays === undefined
            ? undefined
            : Number(body.freshnessDays),
        ignoreInterval:
          body.ignoreInterval === undefined
            ? true
            : Boolean(body.ignoreInterval),
        maxRetryCount:
          body.maxRetryCount === undefined
            ? undefined
            : Number(body.maxRetryCount),
        mode: body.mode === undefined ? undefined : String(body.mode),
        maxConcurrency:
          body.maxConcurrency === undefined
            ? undefined
            : Number(body.maxConcurrency),
        reprocessSuccess:
          body.reprocessSuccess === undefined
            ? undefined
            : Boolean(body.reprocessSuccess),
        retryDelayMinutes:
          body.retryDelayMinutes === undefined
            ? undefined
            : Number(body.retryDelayMinutes),
      }),
    );
    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof CrawlerTaskValidationError) {
      return badRequestResponse(error.message, event);
    }
    console.error('run public opportunity batch crawler failed:', error);
    return serverErrorResponse('运行公开机会批量采集任务失败', event);
  }
});

import { createRadarOperationAudit } from '~/utils/investment-radar/crawler-operation-audit-service';
import {
  checkRadarPermission,
  getRadarActorFromUserInfo,
  RADAR_PERMISSION_CODES,
} from '~/utils/investment-radar/crawler-permission-service';
import { CrawlerTaskValidationError } from '~/utils/investment-radar/crawler-task-repository';
import { runPublicOpportunityBatchCrawler } from '~/utils/investment-radar/public-opportunity-batch-runner';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const permission = checkRadarPermission(
    userinfo,
    RADAR_PERMISSION_CODES.crawlerRun,
  );
  if (!permission.allowed) {
    return forbiddenResponse(event, permission.message);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
    string,
    unknown
  >;

  try {
    const result = await runWithRadarSharedScope(async () => {
      const runResult = await runPublicOpportunityBatchCrawler({
        batchSize: body.batchSize === undefined ? 10 : Number(body.batchSize),
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
        listDiscoveryDelayMs:
          body.listDiscoveryDelayMs === undefined
            ? undefined
            : Number(body.listDiscoveryDelayMs),
        maxRetryCount:
          body.maxRetryCount === undefined
            ? undefined
            : Number(body.maxRetryCount),
        maxListPages:
          body.maxListPages === undefined
            ? undefined
            : Number(body.maxListPages),
        mode: body.mode === undefined ? undefined : String(body.mode),
        maxConcurrency:
          body.maxConcurrency === undefined
            ? undefined
            : Number(body.maxConcurrency),
        maxRounds:
          body.maxRounds === undefined ? undefined : Number(body.maxRounds),
        reprocessSuccess:
          body.reprocessSuccess === undefined
            ? undefined
            : Boolean(body.reprocessSuccess),
        retryDelayMinutes:
          body.retryDelayMinutes === undefined
            ? undefined
            : Number(body.retryDelayMinutes),
        staleReprocessMinutes:
          body.staleReprocessMinutes === undefined
            ? undefined
            : Number(body.staleReprocessMinutes),
        targetCount:
          body.targetCount === undefined ? undefined : Number(body.targetCount),
      });
      await createRadarOperationAudit({
        action: 'CRAWLER_BATCH_RUN',
        ...getRadarActorFromUserInfo(userinfo),
        detailJson: {
          mode: runResult.mode,
          total: runResult.total,
        },
        objectType: 'PUBLIC_CRAWLER_BATCH',
        requestPath: getRequestURL(event).pathname,
        result: runResult.total.failedPlatformCount > 0 ? 'FAILURE' : 'SUCCESS',
        source: 'api',
      });
      return runResult;
    });
    return useResponseSuccess(result);
  } catch (error) {
    await runWithRadarSharedScope(() =>
      createRadarOperationAudit({
        action: 'CRAWLER_BATCH_RUN',
        ...getRadarActorFromUserInfo(userinfo),
        detailJson: { error: String((error as Error)?.message || error) },
        objectType: 'PUBLIC_CRAWLER_BATCH',
        requestPath: getRequestURL(event).pathname,
        result: 'FAILURE',
        source: 'api',
      }),
    ).catch(() => {});
    if (error instanceof CrawlerTaskValidationError) {
      return badRequestResponse(error.message, event);
    }
    console.error('run public opportunity batch crawler failed:', error);
    return serverErrorResponse('运行公开机会批量采集任务失败', event);
  }
});

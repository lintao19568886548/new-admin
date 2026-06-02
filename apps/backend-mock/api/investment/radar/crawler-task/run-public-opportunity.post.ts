import { createRadarOperationAudit } from '~/utils/investment-radar/crawler-operation-audit-service';
import {
  checkRadarPermission,
  getRadarActorFromUserInfo,
  RADAR_PERMISSION_CODES,
} from '~/utils/investment-radar/crawler-permission-service';
import { CrawlerTaskValidationError } from '~/utils/investment-radar/crawler-task-repository';
import { runPublicOpportunityUrlCrawlerTask } from '~/utils/investment-radar/public-opportunity-url-crawler';
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
      const runOptions = {
        batchSize: body.batchSize === undefined ? 10 : Number(body.batchSize),
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
            ? undefined
            : Boolean(body.ignoreInterval),
        listDiscoveryDelayMs:
          body.listDiscoveryDelayMs === undefined
            ? undefined
            : Number(body.listDiscoveryDelayMs),
        maxRetryCount:
          body.maxRetryCount === undefined
            ? undefined
            : Number(body.maxRetryCount),
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
        sourceCode:
          body.sourceCode === undefined ? undefined : String(body.sourceCode),
      };
      const runResult = await runPublicOpportunityUrlCrawlerTask(runOptions);
      await createRadarOperationAudit({
        action: 'CRAWLER_RUN',
        ...getRadarActorFromUserInfo(userinfo),
        detailJson: {
          batchSize: runOptions.batchSize,
          fetchedCount: runResult.fetchedCount,
          taskId: runResult.taskId,
          upsertedCount:
            runResult.createdLeadCount + runResult.updatedLeadCount,
        },
        objectId: runResult.taskId,
        objectType: 'CRAWLER_TASK',
        requestPath: getRequestURL(event).pathname,
        result: runResult.status === 'FAILED' ? 'FAILURE' : 'SUCCESS',
        source: 'api',
      });
      return runResult;
    });
    return useResponseSuccess(result);
  } catch (error) {
    await runWithRadarSharedScope(() =>
      createRadarOperationAudit({
        action: 'CRAWLER_RUN',
        ...getRadarActorFromUserInfo(userinfo),
        detailJson: { error: String((error as Error)?.message || error) },
        objectType: 'CRAWLER_TASK',
        requestPath: getRequestURL(event).pathname,
        result: 'FAILURE',
        source: 'api',
      }),
    ).catch(() => {});
    if (error instanceof CrawlerTaskValidationError) {
      return badRequestResponse(error.message, event);
    }
    console.error('run public opportunity crawler task failed:', error);
    return serverErrorResponse('运行公开机会 URL 采集任务失败', event);
  }
});

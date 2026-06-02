import { createRadarOperationAudit } from '~/utils/investment-radar/crawler-operation-audit-service';
import {
  checkRadarPermission,
  getRadarActorFromUserInfo,
  RADAR_PERMISSION_CODES,
} from '~/utils/investment-radar/crawler-permission-service';
import { stopPublicOpportunityCrawlerScheduler } from '~/utils/investment-radar/public-opportunity-crawler-scheduler';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
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
    RADAR_PERMISSION_CODES.crawlerOpsManage,
  );
  if (!permission.allowed) {
    return forbiddenResponse(event, permission.message);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      const scheduler = stopPublicOpportunityCrawlerScheduler();
      await createRadarOperationAudit({
        action: 'CRAWLER_SCHEDULER_STOP',
        ...getRadarActorFromUserInfo(userinfo),
        detailJson: scheduler,
        objectType: 'CRAWLER_SCHEDULER',
        requestPath: getRequestURL(event).pathname,
        result: 'SUCCESS',
        source: 'api',
      });
      return scheduler;
    });
    return useResponseSuccess(result);
  } catch (error) {
    console.error('stop public opportunity crawler scheduler failed:', error);
    return serverErrorResponse('停止 99cfw 自动采集失败', event);
  }
});

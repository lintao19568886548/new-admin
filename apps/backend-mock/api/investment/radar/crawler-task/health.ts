import { getPublicCrawlerHealthSummary } from '~/utils/investment-radar/crawler-health-service';
import {
  checkRadarPermission,
  RADAR_PERMISSION_CODES,
} from '~/utils/investment-radar/crawler-permission-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { verifyAccessToken } from '~/utils/jwt-utils';
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
    const result = await runWithRadarSharedScope(() =>
      getPublicCrawlerHealthSummary(),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('get public crawler health failed:', error);
    return serverErrorResponse('获取公开采集健康度失败', event);
  }
});

import { eventHandler } from 'h3';
import { getRoiStats } from '~/utils/investment-radar/analytics-service';
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
    RADAR_PERMISSION_CODES.analyticsRead,
  );
  if (!permission.allowed) {
    return forbiddenResponse(event, permission.message);
  }

  try {
    const stats = await runWithRadarSharedScope(() => getRoiStats());
    return useResponseSuccess(stats);
  } catch (error) {
    console.error('get ROI analytics failed:', error);
    return serverErrorResponse('获取ROI分析失败', event);
  }
});

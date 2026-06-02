import { eventHandler } from 'h3';
import { getTemplateConversionStats } from '~/utils/investment-radar/analytics-service';
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
    const stats = await runWithRadarSharedScope(() =>
      getTemplateConversionStats(),
    );
    return useResponseSuccess(stats);
  } catch (error) {
    console.error('get template conversion analytics failed:', error);
    return serverErrorResponse('获取话术转化分析失败', event);
  }
});

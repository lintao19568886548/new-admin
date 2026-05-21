import { eventHandler } from 'h3';
import { getTemplateStats } from '~/utils/investment-radar/analytics-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { verifyAccessToken } from '~/utils/jwt-utils';
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

  try {
    const stats = await runWithRadarSharedScope(() => getTemplateStats());
    return useResponseSuccess(stats);
  } catch (error) {
    console.error('get template analytics failed:', error);
    return serverErrorResponse('获取话术分析数据失败', event);
  }
});

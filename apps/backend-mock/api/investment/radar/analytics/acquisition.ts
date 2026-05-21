import { eventHandler } from 'h3';
import { getAcquisitionStats } from '~/utils/investment-radar/analytics-service';
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
    const stats = await runWithRadarSharedScope(() => getAcquisitionStats());
    return useResponseSuccess(stats);
  } catch (error) {
    console.error('get acquisition analytics failed:', error);
    return serverErrorResponse('获取获客分析数据失败', event);
  }
});

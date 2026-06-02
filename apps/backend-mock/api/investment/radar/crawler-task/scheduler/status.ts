import { getPublicOpportunityCrawlerSchedulerRuntimeStatus } from '~/utils/investment-radar/public-opportunity-crawler-scheduler';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
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
    const result = await runWithRadarSharedScope(async () =>
      getPublicOpportunityCrawlerSchedulerRuntimeStatus(),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error(
      'get public opportunity crawler scheduler status failed:',
      error,
    );
    return serverErrorResponse('获取公开采集自动调度状态失败', event);
  }
});

import { startPublicOpportunityCrawlerScheduler } from '~/utils/investment-radar/public-opportunity-crawler-scheduler';
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
      startPublicOpportunityCrawlerScheduler({
        force: true,
        runImmediately: false,
      }),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('start public opportunity crawler scheduler failed:', error);
    return serverErrorResponse('启动 99cfw 自动采集失败', event);
  }
});

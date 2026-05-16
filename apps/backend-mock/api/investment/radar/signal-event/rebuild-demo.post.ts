import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { rebuildSignalEventsFromExternalLeads } from '~/utils/investment-radar/signal-event-repository';
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
    const result = await runWithRadarSharedScope(() =>
      rebuildSignalEventsFromExternalLeads(),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('rebuild demo signal events failed:', error);
    return serverErrorResponse('重建 demo 企业信号失败', event);
  }
});

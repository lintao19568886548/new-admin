import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { refreshSignalEventsFromExternalLeads } from '~/utils/investment-radar/signal-event-repository';
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
      refreshSignalEventsFromExternalLeads(),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('refresh signal events failed:', error);
    return serverErrorResponse('刷新企业信号失败', event);
  }
});

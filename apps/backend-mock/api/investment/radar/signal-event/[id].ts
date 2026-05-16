import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { getSignalEventDetail } from '~/utils/investment-radar/signal-event-repository';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const eventId = Number(event.context.params?.id);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return badRequestResponse('eventId 无效', event);
  }

  try {
    const result = await runWithRadarSharedScope(() =>
      getSignalEventDetail(eventId),
    );
    if (!result) {
      return badRequestResponse('企业信号不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('get signal event detail failed:', error);
    return serverErrorResponse('获取企业信号详情失败', event);
  }
});

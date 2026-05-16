import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  getSignalEventDetail,
  listSignalEventEvidences,
} from '~/utils/investment-radar/signal-event-repository';
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
    const result = await runWithRadarSharedScope(async () => {
      const signalEvent = await getSignalEventDetail(eventId);
      if (!signalEvent) {
        return null;
      }
      return listSignalEventEvidences(eventId);
    });
    if (!result) {
      return badRequestResponse('企业信号不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('list signal evidences failed:', error);
    return serverErrorResponse('获取企业信号证据失败', event);
  }
});

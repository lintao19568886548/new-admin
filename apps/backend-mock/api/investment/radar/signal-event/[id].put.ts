import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  SignalEventValidationError,
  updateSignalEvent,
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

  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
    string,
    unknown
  >;

  try {
    const result = await runWithRadarSharedScope(() =>
      updateSignalEvent(eventId, {
        status:
          body.status === undefined ? undefined : (String(body.status) as any),
      }),
    );
    if (!result) {
      return badRequestResponse('企业信号不存在', event, 404);
    }
    return useResponseSuccess({
      eventId: result.eventId,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof SignalEventValidationError) {
      return badRequestResponse(error.message, event);
    }
    console.error('update signal event failed:', error);
    return serverErrorResponse('更新企业信号失败', event);
  }
});

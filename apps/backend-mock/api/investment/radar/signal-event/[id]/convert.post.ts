import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { convertSignalEventToRadarLead } from '~/utils/investment-radar/signal-event-repository';
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
      convertSignalEventToRadarLead(eventId, {
        ownerUserId:
          body.ownerUserId === null || body.ownerUserId === undefined
            ? null
            : Number(body.ownerUserId),
        remark:
          body.remark === null || body.remark === undefined
            ? null
            : String(body.remark),
      }),
    );
    if (!result) {
      return badRequestResponse('企业信号不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('convert signal event failed:', error);
    return serverErrorResponse('企业信号转雷达潜客失败', event);
  }
});

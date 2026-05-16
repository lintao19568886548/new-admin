import { convertExternalLeadToRadarLead } from '~/utils/investment-radar/external-lead-repository';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
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

  const leadId = Number(event.context.params?.id);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return badRequestResponse('leadId 无效', event);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
    string,
    unknown
  >;

  try {
    const result = await runWithRadarSharedScope(() =>
      convertExternalLeadToRadarLead(leadId, {
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
      return badRequestResponse('外部公开线索不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('convert external lead failed:', error);
    return serverErrorResponse('外部公开线索转雷达潜客失败', event);
  }
});

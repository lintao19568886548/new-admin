import { getExternalLeadDetail } from '~/utils/investment-radar/external-lead-repository';
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

  try {
    const result = await runWithRadarSharedScope(() =>
      getExternalLeadDetail(leadId),
    );
    if (!result) {
      return badRequestResponse('外部公开线索不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('get external lead detail failed:', error);
    return serverErrorResponse('获取外部公开线索详情失败', event);
  }
});

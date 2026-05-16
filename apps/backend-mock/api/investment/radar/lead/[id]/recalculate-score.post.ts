import { recalculateRadarLeadScore } from '~/utils/investment-radar/lead-score-service';
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
      recalculateRadarLeadScore(leadId),
    );
    if (!result) {
      return badRequestResponse('雷达潜客不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('recalculate radar lead score failed:', error);
    return serverErrorResponse('重算雷达潜客评分失败', event);
  }
});

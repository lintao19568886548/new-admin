import { listRadarLeadScoreBreakdown } from '~/utils/investment-radar/lead-score-service';
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
      listRadarLeadScoreBreakdown(leadId),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('list radar lead score breakdown failed:', error);
    return serverErrorResponse('获取评分拆解失败', event);
  }
});

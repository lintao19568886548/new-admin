import { recalculateRadarLeadScores } from '~/utils/investment-radar/lead-score-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
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
      recalculateRadarLeadScores(),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('recalculate radar lead scores failed:', error);
    return serverErrorResponse('重算潜客评分失败', event);
  }
});

import { listLeadScoreRules } from '~/utils/investment-radar/score-rule-repository';
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
    const result = await runWithRadarSharedScope(() => listLeadScoreRules());
    return useResponseSuccess(result);
  } catch (error) {
    console.error('list lead score rules failed:', error);
    return serverErrorResponse('获取评分规则失败', event);
  }
});

import {
  getEffectivePublicOpportunityOptions,
  normalizeEffectivePublicOpportunityListParams,
} from '~/utils/investment-radar/public-opportunity-effective-list-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { verifyAccessToken } from '~/utils/jwt-utils';
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
    const params = normalizeEffectivePublicOpportunityListParams(
      getQuery(event),
    );
    const result = await runWithRadarSharedScope(async () =>
      getEffectivePublicOpportunityOptions(params),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('get effective public opportunity options failed:', error);
    return serverErrorResponse('获取公开机会筛选项失败', event);
  }
});

import { getPublicOpportunityAuditPreview } from '~/utils/investment-radar/public-opportunity-audit-service';
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
    const result = await runWithRadarSharedScope(() =>
      getPublicOpportunityAuditPreview(),
    );

    return useResponseSuccess(result);
  } catch (error) {
    console.error('audit public opportunity preview failed:', error);
    return serverErrorResponse('公开机会历史数据审计预览失败', event);
  }
});

import { getPublicOpportunityAuditSummary } from '~/utils/investment-radar/public-opportunity-audit-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

function isRefreshQuery(value: unknown) {
  const normalized = Array.isArray(value) ? value[0] : value;
  return ['1', 'on', 'true', 'yes'].includes(
    String(normalized || '')
      .trim()
      .toLowerCase(),
  );
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const result = await runWithRadarSharedScope(() =>
      getPublicOpportunityAuditSummary({
        refresh: isRefreshQuery(query.refresh),
      }),
    );

    return useResponseSuccess(result);
  } catch (error) {
    console.error('audit public opportunity summary failed:', error);
    return serverErrorResponse('公开机会历史数据审计统计失败', event);
  }
});

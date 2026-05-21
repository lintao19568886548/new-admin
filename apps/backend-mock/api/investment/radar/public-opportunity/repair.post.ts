import { repairPublicOpportunityHistory } from '~/utils/investment-radar/public-opportunity-repair-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

function normalizeDryRun(value: unknown) {
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false;
  }
  return true;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
      string,
      unknown
    >;
    const result = await runWithRadarSharedScope(() =>
      repairPublicOpportunityHistory({
        dryRun: normalizeDryRun(body.dryRun),
        limit: body.limit === undefined ? undefined : Number(body.limit),
      }),
    );

    return useResponseSuccess(result);
  } catch (error) {
    console.error('repair public opportunity history failed:', error);
    return serverErrorResponse('公开机会历史数据清洗失败', event);
  }
});

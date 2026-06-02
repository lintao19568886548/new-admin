import { createRadarOperationAudit } from '~/utils/investment-radar/crawler-operation-audit-service';
import {
  checkRadarPermission,
  getRadarActorFromUserInfo,
  RADAR_PERMISSION_CODES,
} from '~/utils/investment-radar/crawler-permission-service';
import { repairPublicOpportunityHistory } from '~/utils/investment-radar/public-opportunity-repair-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  forbiddenResponse,
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
  const permission = checkRadarPermission(
    userinfo,
    RADAR_PERMISSION_CODES.publicOpportunityManage,
  );
  if (!permission.allowed) {
    return forbiddenResponse(event, permission.message);
  }

  try {
    const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
      string,
      unknown
    >;
    const result = await runWithRadarSharedScope(async () => {
      const repairResult = await repairPublicOpportunityHistory({
        dryRun: normalizeDryRun(body.dryRun),
        limit: body.limit === undefined ? undefined : Number(body.limit),
      });
      await createRadarOperationAudit({
        action: 'PUBLIC_OPPORTUNITY_REPAIR',
        ...getRadarActorFromUserInfo(userinfo),
        detailJson: { ...repairResult },
        objectType: 'PUBLIC_OPPORTUNITY',
        requestPath: getRequestURL(event).pathname,
        result: 'SUCCESS',
        source: 'api',
      });
      return repairResult;
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('repair public opportunity history failed:', error);
    return serverErrorResponse('公开机会历史数据清洗失败', event);
  }
});

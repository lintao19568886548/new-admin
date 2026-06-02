import { listContactRestrictionAudits } from '~/utils/investment-radar/contact-restriction-service';
import {
  checkRadarPermission,
  RADAR_PERMISSION_CODES,
} from '~/utils/investment-radar/crawler-permission-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const permission = checkRadarPermission(
    userinfo,
    RADAR_PERMISSION_CODES.auditRead,
  );
  if (!permission.allowed) {
    return forbiddenResponse(event, permission.message);
  }

  try {
    const query = getQuery(event);
    const result = await runWithRadarSharedScope(async () => {
      return await listContactRestrictionAudits({
        action: String(query.action || '').trim(),
        currentPage: Number(query.currentPage || 1),
        keyword: String(query.keyword || '').trim(),
        pageSize: Number(query.pageSize || 20),
        restrictionId: Number(query.restrictionId || 0) || undefined,
      });
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get contact restriction audits failed:', error);
    return serverErrorResponse('获取触达限制审计失败', event);
  }
});

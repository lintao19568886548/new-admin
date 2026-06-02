import { listRadarOperationAudits } from '~/utils/investment-radar/crawler-operation-audit-service';
import {
  checkRadarPermission,
  RADAR_PERMISSION_CODES,
} from '~/utils/investment-radar/crawler-permission-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { verifyAccessToken } from '~/utils/jwt-utils';
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

  const query = getQuery(event);
  try {
    const result = await runWithRadarSharedScope(() =>
      listRadarOperationAudits({
        action: String(query.action || '').trim(),
        currentPage: Number(query.currentPage || 1),
        keyword: String(query.keyword || '').trim(),
        objectType: String(query.objectType || '').trim(),
        pageSize: Number(query.pageSize || 20),
        result: String(query.result || '').trim(),
      }),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('get radar operation audit list failed:', error);
    return serverErrorResponse('获取招商雷达操作审计失败', event);
  }
});

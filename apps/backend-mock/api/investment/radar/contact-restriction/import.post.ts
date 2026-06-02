import { importContactRestrictions } from '~/utils/investment-radar/contact-restriction-service';
import {
  checkRadarPermission,
  RADAR_PERMISSION_CODES,
} from '~/utils/investment-radar/crawler-permission-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
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
    RADAR_PERMISSION_CODES.contactRestrictionManage,
  );
  if (!permission.allowed) {
    return forbiddenResponse(event, permission.message);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
    string,
    unknown
  >;
  const items = Array.isArray(body) ? body : body.items;
  if (!Array.isArray(items)) {
    return badRequestResponse('导入内容必须是数组 JSON', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      return await importContactRestrictions({
        actorId: Number((userinfo as any).userId || (userinfo as any).id || 0),
        actorName: String(
          (userinfo as any).realName || (userinfo as any).username || '',
        ),
        items: items as any[],
      });
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('import contact restrictions failed:', error);
    return serverErrorResponse('导入触达限制名单失败', event);
  }
});

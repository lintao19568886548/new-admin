import { approveReleaseContactRestriction } from '~/utils/investment-radar/contact-restriction-service';
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

  const restrictionId = Number(event.context.params?.id);
  if (!Number.isFinite(restrictionId) || restrictionId <= 0) {
    return badRequestResponse('restrictionId 无效', event);
  }

  try {
    const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
      string,
      unknown
    >;
    const result = await runWithRadarSharedScope(async () => {
      return await approveReleaseContactRestriction({
        actorId: Number((userinfo as any).userId || (userinfo as any).id || 0),
        actorName: String(
          (userinfo as any).realName || (userinfo as any).username || '',
        ),
        remark: String(body.remark || '').trim(),
        restrictionId,
      });
    });

    if (!result) {
      return badRequestResponse('触达限制记录不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('approve contact restriction release failed:', error);
    return serverErrorResponse('审批解除限制失败', event);
  }
});

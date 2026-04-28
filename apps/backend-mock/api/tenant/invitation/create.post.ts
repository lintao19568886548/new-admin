import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import {
  createTenantInvitation,
  TenantInvitationError,
} from '~/utils/tenant-invitation';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  if (!userinfo.roles?.includes('Super')) {
    return forbiddenResponse(event, '仅 Super 角色可创建租户邀请码');
  }

  try {
    const body = (await readBody(event)) as Record<string, unknown>;
    const result = await createTenantInvitation({
      createdByCenterUserId: Number(userinfo.centerUserId ?? userinfo.id),
      customerId: String(userinfo.customerId || ''),
      input: body,
    });

    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof TenantInvitationError) {
      return badRequestResponse(error.message, event, error.statusCode);
    }

    console.error('创建租户邀请码失败:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : '创建租户邀请码失败',
      event,
    );
  }
});

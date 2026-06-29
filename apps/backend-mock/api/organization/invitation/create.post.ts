import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  createOrganizationInvitation,
  OrganizationInvitationError,
} from '~/utils/organization-invitation';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const body = (await readBody(event)) as Record<string, unknown>;
    const result = await createOrganizationInvitation({
      createdByCenterUserId: Number(userinfo.centerUserId ?? userinfo.id),
      customerId: String(userinfo.customerId || ''),
      input: body,
    });

    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof OrganizationInvitationError) {
      return badRequestResponse(error.message, event, error.statusCode);
    }

    console.error('创建组织邀请码失败:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : '创建组织邀请码失败',
      event,
    );
  }
});

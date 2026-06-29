import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  listOrganizationInvitations,
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
    const result = await listOrganizationInvitations(
      String(userinfo.customerId || ''),
    );
    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof OrganizationInvitationError) {
      return badRequestResponse(error.message, event, error.statusCode);
    }

    console.error('读取组织邀请码失败:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : '读取组织邀请码失败',
      event,
    );
  }
});

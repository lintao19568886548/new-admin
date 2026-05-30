import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  joinOrganizationByInvitationCode,
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
    const result = await joinOrganizationByInvitationCode({
      centerUserId: Number(userinfo.centerUserId ?? userinfo.id),
      code: body.code,
    });

    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof OrganizationInvitationError) {
      return badRequestResponse(error.message, event, error.statusCode);
    }

    console.error('加入已有租户失败:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : '加入已有租户失败',
      event,
    );
  }
});

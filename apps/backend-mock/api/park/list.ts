import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { resolveUserAuthorizedParks } from '~/utils/user-park-scope';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const parks = await resolveUserAuthorizedParks({
    roleNames: userinfo.roles,
    userId: Number(userinfo.id),
  });

  return useResponseSuccess(parks);
});

import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { getTenantProvisioningProfileState } from '~/utils/vip-membership';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const centerUserId = Number(userinfo.centerUserId ?? userinfo.id);
  if (!Number.isFinite(centerUserId) || centerUserId <= 0) {
    return unAuthorizedResponse(event);
  }

  return useResponseSuccess(
    await getTenantProvisioningProfileState(centerUserId),
  );
});

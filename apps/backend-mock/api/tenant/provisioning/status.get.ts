import { systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { verifyVipCheckoutFlowTokenFromEvent } from '~/utils/vip-checkout-flow-token';
import { getTenantProvisioningProfileState } from '~/utils/vip-membership';

export default eventHandler(async (event) => {
  const flowTokenPayload =
    event.context.vipCheckoutFlow ?? verifyVipCheckoutFlowTokenFromEvent(event);
  const userinfo = flowTokenPayload ? null : await verifyAccessToken(event);
  if (!flowTokenPayload && !userinfo) {
    return unAuthorizedResponse(event);
  }

  const centerUserId = Number(
    flowTokenPayload?.centerUserId ?? userinfo?.centerUserId ?? userinfo?.id,
  );
  if (!Number.isFinite(centerUserId) || centerUserId <= 0) {
    return unAuthorizedResponse(event);
  }

  const sourceCustomerId =
    flowTokenPayload?.sourceCustomerId ?? userinfo?.customerId;
  const [provisioningState, centerUser] = await Promise.all([
    getTenantProvisioningProfileState(
      centerUserId,
      systemDbClient,
      sourceCustomerId,
    ),
    systemDbClient.user.findUnique({
      select: { customerType: true },
      where: { id: centerUserId },
    }),
  ]);
  if (!centerUser) {
    return unAuthorizedResponse(event);
  }

  const currentCustomerId = centerUser.customerType
    ? String(centerUser.customerType)
    : undefined;
  return useResponseSuccess({
    ...provisioningState,
    currentCustomerId,
    requiresRelogin: Boolean(
      currentCustomerId &&
      sourceCustomerId &&
      currentCustomerId !== sourceCustomerId,
    ),
  });
});

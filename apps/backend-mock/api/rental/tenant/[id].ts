import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const rentalTenantId = Number.parseInt(event.context.params.id);
  if (!rentalTenantId) {
    return useResponseError('tenantId错误');
  }

  const tenant = await prismaClient.rentalTenant.findUnique({
    where: {
      rentalTenantId,
    },
  });
  return useResponseSuccess(tenant);
});

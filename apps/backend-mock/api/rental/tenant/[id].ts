import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const tenantId = Number.parseInt(event.context.params.id);
  if (!tenantId) {
    return useResponseError('tenantId错误');
  }

  const tenant = await prismaClient.tenant.findUnique({
    where: {
      tenantId,
    },
  });
  return useResponseSuccess(tenant);
});

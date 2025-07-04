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

  try {
    await prismaClient.rentalTenant.delete({
      where: {
        rentalTenantId,
      },
    });
    return useResponseSuccess(null);
  } catch (error) {
    console.error('删除租户失败:', error);
    return serverErrorResponse(`删除租户失败`, event);
  }
});

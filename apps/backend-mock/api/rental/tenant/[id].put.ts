import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const rentalTenantId = Number.parseInt(event.context.params.id);
  if (!rentalTenantId) {
    return useResponseError('tenantId错误');
  }

  console.log(body);
  try {
    const tenant = await prismaClient.rentalTenant.update({
      where: {
        rentalTenantId,
      },
      data: {
        ...body,
      },
    });
    return useResponseSuccess(tenant);
  } catch (error) {
    console.error('更新租户失败:', error);
    return serverErrorResponse(`更新租户失败`, event);
  }
});

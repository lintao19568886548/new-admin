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
    const result = await prismaClient.$transaction(async (tx) => {
      await tx.salary.updateMany({
        where: {
          rentalTenantId,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
        },
      });
      return tx.rentalTenant.update({
        where: {
          rentalTenantId,
        },
        data: {
          isDeleted: true,
        },
      });
    });
    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除租户失败:', error);
    return serverErrorResponse(`删除租户失败`, event);
  }
});

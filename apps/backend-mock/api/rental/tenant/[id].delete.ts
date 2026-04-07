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
      await tx.tenantImage.deleteMany({
        where: {
          rentalTenantId,
        },
      });
      await tx.rentalTenantParty.deleteMany({
        where: {
          rentalTenantId,
        },
      });
      await tx.salary.updateMany({
        where: {
          rentalTenantId,
        },
        data: {
          isDeleted: true,
        },
      });
      await tx.rentalTenant.delete({
        where: {
          rentalTenantId,
        },
      });
    });
    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除租户失败:', error);
    return serverErrorResponse(`删除租户失败`, event);
  }
});

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

  try {
    const tenant = await prismaClient.rentalTenant.update({
      where: {
        rentalTenantId,
      },
      data: {
        tenantName: body.tenantName,
        phoneNumber: body.phoneNumber,
        status: body.status,
        contractDate: new Date(body.contractDate), // 修改这里，转换为 Date 对象
        increaseDate: new Date(body.increaseDate), // 修改这里，转换为 Date 对象
        increaseRate: Number.parseFloat(body.increaseRate),
        address: body.address,
        updateTime: new Date(),
      },
    });
    return useResponseSuccess(tenant);
  } catch (error) {
    console.error('更新租户失败:', error);
    return useResponseError('更新租户失败', 500);
  }
});

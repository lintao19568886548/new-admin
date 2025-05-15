import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }

  const factoryMaintenanceId = Number.parseInt(event.context.params.id);
  if (!factoryMaintenanceId) {
    return useResponseError('factoryMaintenanceId错误');
  }

  try {
    const result = await prismaClient.factoryMaintenance.delete({
      where: {
        factoryMaintenanceId,
      },
    });

    console.log('删除账单成功:', result);
    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除账单失败:', error);
    return serverErrorResponse(`删除账单失败\n${error}`, event);
  }
});

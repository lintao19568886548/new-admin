import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const id = Number.parseInt(event.context.params.id);
  if (!id) {
    return useResponseError('carId错误');
  }

  try {
    const accessCar = await prismaClient.accessCar.update({
      where: {
        carId: id,
      },
      data: {
        ...body,
      },
    });
    return useResponseSuccess(accessCar);
  } catch (error) {
    console.error('更新车辆信息失败:', error);
    return useResponseError('更新车辆信息失败', 500);
  }
});

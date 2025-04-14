import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);

  try {
    const accessCar = await prismaClient.accessCar.create({
      data: {
        ...body,
      },
    });

    return useResponseSuccess(accessCar);
  } catch (error) {
    console.error('创建车辆信息失败:', error);
    return useResponseError('创建车辆信息失败', 500);
  }
});

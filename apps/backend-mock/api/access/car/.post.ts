import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);

  try {
    const car = await prismaClient.car.create({
      data: {
        ...body,
      },
    });

    return useResponseSuccess(car);
  } catch (error) {
    console.error('创建访客信息失败:', error);
    return useResponseError('创建访客信息失败', 500);
  }
});

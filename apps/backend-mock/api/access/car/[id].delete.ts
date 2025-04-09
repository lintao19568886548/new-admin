import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const id = Number.parseInt(event.context.params.id);
  if (!id) {
    return useResponseError('carId错误');
  }

  try {
    await prismaClient.car.delete({
      where: {
        carId: id,
      },
    });
    return useResponseSuccess(null);
  } catch (error) {
    console.error('删除访客信息失败:', error);
    return useResponseError('删除访客信息失败', 500);
  }
});

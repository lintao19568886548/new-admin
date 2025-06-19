import { prismaClient } from '~/utils/db';
import {
  serverErrorResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

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
    await prismaClient.accessCar.delete({
      where: {
        carId: id,
      },
    });
    return useResponseSuccess(null);
  } catch (error) {
    console.error('删除车辆信息失败:', error);
    return serverErrorResponse(`删除车辆信息失败`, event);
  }
});

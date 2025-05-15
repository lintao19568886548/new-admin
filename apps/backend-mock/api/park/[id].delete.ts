import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const parkId = Number.parseInt(event.context.params.id);
  if (!parkId) {
    return useResponseError('parkId错误');
  }

  try {
    const result = await prismaClient.park.delete({
      where: {
        parkId,
      },
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除账单失败:', error);
    return serverErrorResponse(`删除账单失败\n${error}`, event);
  }
});

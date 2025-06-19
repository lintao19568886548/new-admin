import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }

  const firefightingId = Number.parseInt(event.context.params.id);
  if (!firefightingId) {
    return useResponseError('firefightingId错误');
  }

  try {
    const result = await prismaClient.firefighting.delete({
      where: {
        firefightingId,
      },
    });

    console.log('删除账单成功:', result);
    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除账单失败:', error);
    return serverErrorResponse(`删除账单失败`, event);
  }
});

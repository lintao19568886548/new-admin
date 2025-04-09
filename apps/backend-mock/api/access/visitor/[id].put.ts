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
    return useResponseError('visitorId错误');
  }

  try {
    const visitor = await prismaClient.visitor.update({
      where: {
        visitorId: id,
      },
      data: {
        ...body,
      },
    });
    return useResponseSuccess(visitor);
  } catch (error) {
    console.error('更新访客信息失败:', error);
    return useResponseError('更新访客信息失败', 500);
  }
});

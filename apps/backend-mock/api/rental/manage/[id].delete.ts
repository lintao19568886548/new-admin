import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const id = Number.parseInt(event.context.params.id);
  if (!id) {
    return useResponseError('factoryId错误');
  }

  try {
    await prismaClient.factory.delete({
      where: {
        factoryId: id,
      },
    });
    return useResponseSuccess(null);
  } catch (error) {
    console.error('删除厂房失败:', error);
    return useResponseError('删除厂房失败', 500);
  }
});

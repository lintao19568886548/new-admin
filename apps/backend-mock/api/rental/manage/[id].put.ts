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
    return useResponseError('factoryId错误');
  }

  try {
    const factory = await prismaClient.factory.update({
      where: {
        factoryId: id,
      },
      data: {
        ...body,
      },
    });
    return useResponseSuccess(factory);
  } catch (error) {
    console.error('更新厂房失败:', error);
    return useResponseError('更新厂房失败', 500);
  }
});

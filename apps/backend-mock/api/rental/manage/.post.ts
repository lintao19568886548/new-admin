import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);

  try {
    const factory = await prismaClient.factory.create({
      data: {
        ...body,
      },
    });

    return useResponseSuccess(factory);
  } catch (error) {
    console.error('创建厂房失败:', error);
    return useResponseError('创建厂房失败', 500);
  }
});

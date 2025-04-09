import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);

  try {
    const tenant = await prismaClient.rentalManage.create({
      data: {
        ...body,
      },
    });

    return useResponseSuccess(tenant);
  } catch (error) {
    console.error('创建租户失败:', error);
    return useResponseError('创建租户失败', 500);
  }
});

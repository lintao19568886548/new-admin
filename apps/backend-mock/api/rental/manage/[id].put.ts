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
    return useResponseError('tenantId错误2');
  }

  try {
    const tenant = await prismaClient.rentalManage.update({
      where: {
        rentalManageId: id,
      },
      data: {
        ...body,
      },
    });
    return useResponseSuccess(tenant);
  } catch (error) {
    console.error('更新租户失败:', error);
    return useResponseError('更新租户失败', 500);
  }
});

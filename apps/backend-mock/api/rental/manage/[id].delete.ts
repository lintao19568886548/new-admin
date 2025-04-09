import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const id = Number.parseInt(event.context.params.id);
  if (!id) {
    return useResponseError('tenantId错误1');
  }

  try {
    await prismaClient.rentalManage.delete({
      where: {
        rentalManageId: id,
      },
    });
    return useResponseSuccess(null);
  } catch (error) {
    console.error('删除租户失败:', error);
    return useResponseError('删除租户失败', 500);
  }
});

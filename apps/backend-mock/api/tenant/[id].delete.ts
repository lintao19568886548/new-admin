import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const tenantId = Number.parseInt(event.context.params.id);
  if (!tenantId) {
    return useResponseError('tenantId错误');
  }

  try {
    await prismaClient.tenant.delete({
      where: {
        tenantId,
      },
    });
    return useResponseSuccess(null);
  } catch (error) {
    console.error('删除租户失败:', error);
    return useResponseError('删除租户失败', 500);
  }
});

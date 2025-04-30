import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const id = Number.parseInt(event.context.params.id);
  if (!id) {
    return useResponseError('id不能为空');
  }

  try {
    // 使用事务处理逻辑删除操作
    const result = await prismaClient.$transaction(async (prisma) => {
      // 首先获取园区信息，确认园区存在
      // 最后逻辑删除园区
      return await prisma.park.update({
        where: {
          parkId: id,
        },
        data: {
          isDeleted: true,
        },
      });
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除失败:', error);
    return useResponseError('删除失败', 500);
  }
});

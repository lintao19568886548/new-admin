import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const menuId = Number.parseInt(event.context.params.id);
  if (!menuId) {
    return useResponseError('billId错误');
  }

  try {
    // 使用事务处理删除操作
    const result = await prismaClient.$transaction(async (prisma) => {
      await prisma.menu.delete({
        where: {
          menuId,
        },
      });
    });
    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除失败:', error);
    return useResponseError('删除失败', 500);
  }
});

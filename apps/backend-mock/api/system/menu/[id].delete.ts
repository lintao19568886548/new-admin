import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const menuId = Number.parseInt(event.context.params.id);
  if (!menuId) {
    return useResponseError('menuId错误');
  }

  try {
    // 使用事务处理删除操作
    const result = await prismaClient.$transaction(async (prisma) => {
      // 先获取菜单信息，检查是否为button类型
      const menu = await prisma.menu.findUnique({
        where: { menuId },
        select: { type: true, authCode: true },
      });

      // 如果菜单类型为button，先删除对应的权限码记录
      if (menu?.type === 'button' && menu.authCode) {
        await prisma.code.deleteMany({
          where: {
            code: menu.authCode,
            menuId,
          },
        });
      }

      // 删除菜单（由于设置了级联删除，相关的code记录也会被删除）
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

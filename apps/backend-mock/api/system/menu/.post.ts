import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const { meta, ...menuData } = body;
  try {
    const res = await prismaClient.$transaction(async (prisma) => {
      // 创建菜单
      const menu = await prisma.menu.create({
        data: {
          ...menuData,
          meta: {
            create: meta,
          },
        },
        include: {
          meta: true,
        },
      });

      // 如果菜单类型为button，创建对应的权限码记录
      if (menuData.type === 'button' && menuData.authCode) {
        await prisma.code.create({
          data: {
            code: menuData.authCode,
            name: meta.title,
            content: meta.title,
            menuId: menu.menuId,
          },
        });
      }

      return menu;
    });
    return useResponseSuccess(res);
  } catch (error) {
    console.error('插入数据失败:', error);
    return useResponseError('插入数据失败', 500);
  }
});

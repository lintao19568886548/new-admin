import { prismaClient } from '~/utils/db';
import { processMenuData } from '~/utils/tools';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const menus = await prismaClient.menu.findMany({
    where: {
      pid: null, // 只查询顶级菜单（pid 为 null 的菜单）
    },
    include: {
      meta: true, // 包含菜单元数据
      children: {
        include: {
          meta: true, // 包含子菜单的元数据
          children: {
            include: {
              meta: true, // 如果需要更深层次的子菜单，可以继续嵌套
            },
          },
        },
      },
    },
  });

  // 一次性处理所有数据转换
  const processedMenus = processMenuData(menus, {
    removeEmptyFields: true,
    fieldsToRemove: ['menuId', 'metaId', 'type', 'status', 'pid'],
    removeEmptyChildren: true,
  });

  return useResponseSuccess(processedMenus);
});

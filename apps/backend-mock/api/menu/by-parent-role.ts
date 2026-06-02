import { verifyAccessToken } from '~/utils/jwt-utils';
import { normalizeParkManagementMenuPlacement } from '~/utils/park-menu-placement';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { processMenuData } from '~/utils/tools';

/**
 * 根据父角色权限获取菜单列表
 * 用于限制子角色的权限树显示范围
 */
export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const { parentRoleId } = getQuery(event);

  // 如果没有父角色ID，返回所有菜单（顶级角色）
  if (!parentRoleId) {
    const allMenus = await prismaClient.menu.findMany({
      where: {
        pid: null, // 只查询顶级菜单
      },
      include: {
        meta: true,
        code: true,
        children: {
          include: {
            meta: true,
            code: true,
            children: {
              include: {
                meta: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: {
        meta: {
          order: 'asc', // 按照菜单的order字段升序排序
        },
      },
    });

    // 处理菜单数据
    const processedMenus = processMenuData(allMenus, {
      removeEmptyFields: true,
      fieldsToRemove: [],
      removeEmptyChildren: true,
    });

    return useResponseSuccess(
      normalizeParkManagementMenuPlacement(processedMenus, {
        ensureParkWhenMissing: userinfo.roles?.includes('Super') ?? false,
        preferLegacyMenu: true,
      }),
    );
  }

  // 根据父角色ID获取父角色的权限菜单
  const parentRoleMenus = await prismaClient.roleMenu.findMany({
    where: {
      roleId: Number(parentRoleId),
      isDeleted: false, // 排除软删除的记录
    },
    select: {
      menuId: true,
    },
  });

  // 提取父角色的菜单ID并去重
  const parentMenuIds = [...new Set(parentRoleMenus.map((rm) => rm.menuId))];

  // 如果父角色没有任何权限，返回空数组
  if (parentMenuIds.length === 0) {
    return useResponseSuccess([]);
  }

  // 查询父角色有权限的顶级菜单
  const menus = await prismaClient.menu.findMany({
    where: {
      pid: null, // 只查询顶级菜单
      menuId: {
        in: parentMenuIds, // 只查询父角色有权限的菜单
      },
    },
    include: {
      meta: true,
      code: true,
      children: {
        where: {
          menuId: {
            in: parentMenuIds, // 只包含父角色有权限的子菜单
          },
        },
        include: {
          meta: true,
          code: true,
          children: {
            where: {
              menuId: {
                in: parentMenuIds, // 只包含父角色有权限的孙菜单
              },
            },
            include: {
              meta: true,
              code: true,
            },
          },
        },
      },
    },
    orderBy: {
      meta: {
        order: 'asc', // 按照菜单的order字段升序排序
      },
    },
  });

  // 一次性处理所有数据转换
  const processedMenus = processMenuData(menus, {
    removeEmptyFields: true,
    fieldsToRemove: [],
    removeEmptyChildren: true,
  });

  return useResponseSuccess(
    normalizeParkManagementMenuPlacement(processedMenus, {
      preferLegacyMenu: true,
    }),
  );
});

import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { processMenuData } from '~/utils/tools';

function hasVipMembershipMenu(menus: any[]) {
  const queue = [...menus];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }

    if (
      current.name === 'ProfileVipMembership' ||
      current.path === '/profile/vip-membership'
    ) {
      return true;
    }

    if (Array.isArray(current.children) && current.children.length > 0) {
      queue.push(...current.children);
    }
  }

  return false;
}

function createVipMembershipMenu() {
  return {
    authCode: 'profile:vip-membership',
    component: '/profile/vip-membership',
    meta: {
      activePath: '/profile',
      hideInMenu: true,
      icon: 'mdi:crown-outline',
      title: '会员服务',
    },
    name: 'ProfileVipMembership',
    path: '/profile/vip-membership',
    type: 'menu',
  };
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const roleNames = userinfo.roles;

  // 检查是否有Super角色权限
  const hasSuperRole = roleNames.includes('Super');

  // 如果有Super权限，直接查询所有菜单
  if (hasSuperRole) {
    const allMenus = await prismaClient.menu.findMany({
      where: {
        pid: null, // 只查询顶级菜单
        status: 1,
        type: {
          not: 'button',
        },
      },
      orderBy: {
        meta: {
          order: 'asc',
        },
      },
      include: {
        meta: true,
        children: {
          where: {
            status: 1,
            type: {
              not: 'button',
            },
          },
          include: {
            meta: true,
            children: {
              where: {
                status: 1,
                type: {
                  not: 'button',
                },
              },
              include: {
                meta: true,
              },
            },
          },
        },
      },
    });

    // 处理菜单数据
    const processedMenus = processMenuData(allMenus, {
      removeEmptyFields: true,
      fieldsToRemove: ['menuId', 'metaId', 'status', 'pid'],
      removeEmptyChildren: true,
    });

    const normalizedMenus = hasVipMembershipMenu(processedMenus)
      ? processedMenus
      : [...processedMenus, createVipMembershipMenu()];

    return useResponseSuccess(normalizedMenus);
  }

  // 非Super角色的原有逻辑
  // 先根据角色名称查询角色ID
  const roleEntities = await prismaClient.role.findMany({
    where: {
      name: {
        in: roleNames,
      },
    },
    select: {
      roleId: true,
    },
  });

  const roleIds = roleEntities.map((role) => role.roleId);

  // 根据用户角色获取菜单ID列表
  const roleMenus = await prismaClient.roleMenu.findMany({
    where: {
      roleId: {
        in: roleIds,
      },
      isDeleted: false, // 排除软删除的记录
    },
    select: {
      menuId: true,
    },
  });

  // 提取菜单ID并去重
  const menuIds = [...new Set(roleMenus.map((rm) => rm.menuId))];

  // 查询用户有权限的顶级菜单
  const menus = await prismaClient.menu.findMany({
    where: {
      pid: null, // 只查询顶级菜单
      status: 1,
      menuId: {
        in: menuIds, // 只查询用户有权限的菜单
      },
      type: {
        not: 'button',
      },
    },
    orderBy: {
      meta: {
        order: 'asc',
      },
    },
    include: {
      meta: true,
      children: {
        where: {
          status: 1,
          type: {
            not: 'button',
          },
          menuId: {
            in: menuIds, // 只包含用户有权限的子菜单
          },
        },
        include: {
          meta: true,
          children: {
            where: {
              status: 1,
              type: {
                not: 'button',
              },
              menuId: {
                in: menuIds, // 只包含用户有权限的孙菜单
              },
            },
            include: {
              meta: true,
            },
          },
        },
      },
    },
  });

  // 一次性处理所有数据转换
  const processedMenus = processMenuData(menus, {
    removeEmptyFields: true,
    fieldsToRemove: ['menuId', 'metaId', 'status', 'pid'],
    removeEmptyChildren: true,
  });

  const normalizedMenus = hasVipMembershipMenu(processedMenus)
    ? processedMenus
    : [...processedMenus, createVipMembershipMenu()];

  return useResponseSuccess(normalizedMenus);
});

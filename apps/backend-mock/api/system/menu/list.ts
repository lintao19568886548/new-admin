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

  const menus = await prismaClient.menu.findMany({
    where: {
      pid: null, // 只查询顶级菜单（pid 为 null 的菜单）
    },
    orderBy: {
      meta: {
        order: 'asc', // 根据排序字段进行升序排序
      },
    },
    include: {
      meta: true, // 包含菜单元数据
      code: true, // 包含权限码数据
      children: {
        include: {
          meta: true, // 包含子菜单的元数据
          code: true, // 包含权限码数据
          children: {
            include: {
              meta: true, // 如果需要更深层次的子菜单，可以继续嵌套
              code: true, // 包含权限码数据
            },
          },
        },
      },
    },
  });

  // 一次性处理所有数据转换
  const processedMenus = processMenuData(menus, {
    removeEmptyFields: true,
    fieldsToRemove: [],
    removeEmptyChildren: true,
  });

  const normalizedMenus = hasVipMembershipMenu(processedMenus)
    ? processedMenus
    : [...processedMenus, createVipMembershipMenu()];

  return useResponseSuccess(normalizedMenus);
});

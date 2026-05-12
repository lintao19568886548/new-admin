const PROFILE_AUXILIARY_ROUTE_MENUS = [
  {
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
  },
  {
    authCode: 'profile:tenant-invitations',
    component: '/profile/tenant-invitations',
    meta: {
      activePath: '/profile',
      hideInMenu: true,
      icon: 'mdi:ticket-confirmation-outline',
      title: '企业邀请码',
    },
    name: 'ProfileTenantInvitations',
    path: '/profile/tenant-invitations',
    type: 'menu',
  },
  {
    authCode: 'profile:vip-refunds',
    component: '/profile/vip-refunds',
    meta: {
      activePath: '/profile',
      hideInMenu: true,
      icon: 'mdi:cash-refund',
      title: '会员退款订单',
    },
    name: 'ProfileVipRefunds',
    path: '/profile/vip-refunds',
    type: 'menu',
  },
] as const;

function hasRouteMenu(
  menus: any[],
  route: {
    name: string;
    path: string;
  },
) {
  const queue = [...menus];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }

    if (current.name === route.name || current.path === route.path) {
      return true;
    }

    if (Array.isArray(current.children) && current.children.length > 0) {
      queue.push(...current.children);
    }
  }

  return false;
}

function appendRouteMenus(menus: any[], routes: readonly any[]) {
  const normalizedMenus = [...menus];
  for (const route of routes) {
    if (!hasRouteMenu(normalizedMenus, route)) {
      normalizedMenus.push(route);
    }
  }
  return normalizedMenus;
}

export function appendProfileAuxiliaryRouteMenus(menus: any[]) {
  return appendRouteMenus(menus, PROFILE_AUXILIARY_ROUTE_MENUS);
}

export { PROFILE_AUXILIARY_ROUTE_MENUS };

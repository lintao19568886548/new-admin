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
    authCode: 'profile:organization-invitations',
    component: '/profile/organization-invitations',
    meta: {
      activePath: '/profile',
      hideInMenu: true,
      icon: 'mdi:ticket-confirmation-outline',
      title: '企业邀请码',
    },
    name: 'ProfileOrganizationInvitations',
    path: '/profile/organization-invitations',
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

const INVESTMENT_RADAR_AUXILIARY_ROUTE_MENUS = [
  {
    authCode: 'investment:radar',
    component: '/investment/radar/list',
    meta: {
      icon: 'mdi:radar',
      order: 2,
      title: '智能招商雷达',
    },
    name: 'InvestmentRadar',
    path: '/investment/radar',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-detail',
    component: '/investment/radar/detail',
    meta: {
      activePath: '/investment/radar',
      hideInMenu: true,
      icon: 'mdi:file-document-outline',
      title: '招商线索详情',
    },
    name: 'InvestmentRadarDetail',
    path: '/investment/radar/:id',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-dashboard',
    component: '/investment/radar/dashboard',
    meta: {
      activePath: '/investment/radar',
      hideInMenu: true,
      icon: 'lucide:area-chart',
      title: '招商雷达看板',
    },
    name: 'InvestmentRadarDashboard',
    path: '/investment/radar-dashboard',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-tasks',
    component: '/investment/radar/tasks',
    meta: {
      activePath: '/investment/radar',
      hideInMenu: true,
      icon: 'mdi:message-processing-outline',
      title: '招商触达任务',
    },
    name: 'InvestmentRadarTasks',
    path: '/investment/radar-tasks',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-public-demands',
    component: '/investment/radar/public-demands',
    meta: {
      activePath: '/investment/radar',
      hideInMenu: true,
      icon: 'mdi:briefcase-search-outline',
      title: '公开需求采集',
    },
    name: 'InvestmentRadarPublicDemands',
    path: '/investment/radar-public-demands',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-factory-listings',
    component: '/investment/radar/factory-listings',
    meta: {
      activePath: '/investment/radar',
      hideInMenu: true,
      icon: 'mdi:factory',
      title: '公开房源采集',
    },
    name: 'InvestmentRadarFactoryListings',
    path: '/investment/radar-factory-listings',
    type: 'menu',
  },
] as const;

const INVESTMENT_MOBILE_APP_ROUTE_MENUS = [
  {
    authCode: 'investment:mobile-app',
    component: '/investment/app/index',
    meta: {
      hideInMenu: true,
      icon: 'lucide:briefcase-business',
      isApp: true,
      order: 0,
      title: '招商工作台',
    },
    name: 'InvestmentApp',
    path: '/investment/app',
    type: 'menu',
  },
  {
    authCode: 'investment:agent-mobile',
    component: '/investment/agent/mobile-list',
    meta: {
      activePath: '/investment',
      hideInMenu: true,
      icon: 'mdi:account-tie',
      isApp: true,
      order: 10,
      title: '招商记录',
    },
    name: 'InvestmentAgentMobileList',
    path: '/investment/mobile',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-mobile',
    component: '/investment/radar/mobile-list',
    meta: {
      activePath: '/investment/radar',
      hideInMenu: true,
      icon: 'mdi:radar',
      isApp: true,
      order: 20,
      title: '智能招商雷达',
    },
    name: 'InvestmentRadarMobileList',
    path: '/investment/radar/mobile',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-mobile-detail',
    component: '/investment/radar/mobile-detail',
    meta: {
      activePath: '/investment/radar/mobile',
      hideInMenu: true,
      hideInTab: true,
      icon: 'mdi:file-document-outline',
      title: '潜客详情',
    },
    name: 'InvestmentRadarMobileDetail',
    path: '/investment/radar/mobile/:id',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-mobile-tasks',
    component: '/investment/radar/tasks',
    meta: {
      activePath: '/investment/radar/mobile',
      hideInMenu: true,
      icon: 'mdi:message-processing-outline',
      isApp: true,
      order: 30,
      title: '触达任务',
    },
    name: 'InvestmentRadarMobileTasks',
    path: '/investment/radar/mobile-tasks',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-mobile-dashboard',
    component: '/investment/radar/dashboard',
    meta: {
      activePath: '/investment/radar/mobile',
      hideInMenu: true,
      icon: 'lucide:area-chart',
      isApp: true,
      order: 40,
      title: '招商看板',
    },
    name: 'InvestmentRadarMobileDashboard',
    path: '/investment/radar/mobile-dashboard',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-mobile-public-demands',
    component: '/investment/radar/mobile-public-demands',
    meta: {
      activePath: '/investment/radar/mobile',
      hideInMenu: true,
      icon: 'mdi:briefcase-search-outline',
      isApp: true,
      order: 50,
      title: '公开需求',
    },
    name: 'InvestmentRadarMobilePublicDemands',
    path: '/investment/radar/mobile-public-demands',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-mobile-factory-listings',
    component: '/investment/radar/mobile-factory-listings',
    meta: {
      activePath: '/investment/radar/mobile',
      hideInMenu: true,
      icon: 'mdi:factory',
      isApp: true,
      order: 60,
      title: '公开房源',
    },
    name: 'InvestmentRadarMobileFactoryListings',
    path: '/investment/radar/mobile-factory-listings',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-mobile-external-leads',
    component: '/investment/radar/mobile-external-leads',
    meta: {
      activePath: '/investment/radar/mobile',
      hideInMenu: true,
      icon: 'mdi:account-search-outline',
      isApp: true,
      order: 70,
      title: '外部公开线索',
    },
    name: 'InvestmentRadarMobileExternalLeads',
    path: '/investment/radar/mobile-external-leads',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-mobile-signal-events',
    component: '/investment/radar/mobile-signal-events',
    meta: {
      activePath: '/investment/radar/mobile',
      hideInMenu: true,
      icon: 'mdi:pulse',
      isApp: true,
      order: 80,
      title: '企业信号',
    },
    name: 'InvestmentRadarMobileSignalEvents',
    path: '/investment/radar/mobile-signal-events',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-mobile-enterprise-profiles',
    component: '/investment/radar/mobile-enterprise-profiles',
    meta: {
      activePath: '/investment/radar/mobile',
      hideInMenu: true,
      icon: 'mdi:office-building-cog-outline',
      isApp: true,
      order: 90,
      title: '企业画像',
    },
    name: 'InvestmentRadarMobileEnterpriseProfiles',
    path: '/investment/radar/mobile-enterprise-profiles',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-mobile-score-rules',
    component: '/investment/radar/mobile-score-rules',
    meta: {
      activePath: '/investment/radar/mobile',
      hideInMenu: true,
      icon: 'mdi:scoreboard-outline',
      isApp: true,
      order: 100,
      title: '评分规则',
    },
    name: 'InvestmentRadarMobileScoreRules',
    path: '/investment/radar/mobile-score-rules',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-mobile-crawler-sources',
    component: '/investment/radar/mobile-crawler-sources',
    meta: {
      activePath: '/investment/radar/mobile',
      hideInMenu: true,
      icon: 'mdi:database-cog-outline',
      isApp: true,
      order: 110,
      title: '数据源',
    },
    name: 'InvestmentRadarMobileCrawlerSources',
    path: '/investment/radar/mobile-crawler-sources',
    type: 'menu',
  },
  {
    authCode: 'investment:radar-mobile-crawler-tasks',
    component: '/investment/radar/mobile-crawler-tasks',
    meta: {
      activePath: '/investment/radar/mobile',
      hideInMenu: true,
      icon: 'mdi:timeline-clock-outline',
      isApp: true,
      order: 120,
      title: '采集任务',
    },
    name: 'InvestmentRadarMobileCrawlerTasks',
    path: '/investment/radar/mobile-crawler-tasks',
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

function appendChildRouteMenus(
  menus: any[],
  parentRoute: {
    name: string;
    path: string;
  },
  routes: readonly any[],
) {
  let parentFound = false;

  const visit = (items: any[]): any[] =>
    items.map((item) => {
      if (!item || typeof item !== 'object') {
        return item;
      }

      if (item.name === parentRoute.name || item.path === parentRoute.path) {
        parentFound = true;
        return {
          ...item,
          children: appendRouteMenus(
            Array.isArray(item.children) ? item.children : [],
            routes,
          ),
        };
      }

      if (Array.isArray(item.children) && item.children.length > 0) {
        return {
          ...item,
          children: visit(item.children),
        };
      }

      return item;
    });

  const nextMenus = visit(menus);
  return parentFound ? nextMenus : menus;
}

function shouldAppendInvestmentRadarRouteMenus(menus: any[]) {
  return (
    hasRouteMenu(menus, {
      name: 'Investment',
      path: '/investment',
    }) ||
    hasRouteMenu(menus, {
      name: 'InvestmentRadar',
      path: '/investment/radar',
    })
  );
}

export function appendProfileAuxiliaryRouteMenus(menus: any[]) {
  const normalizedMenus = appendRouteMenus(
    menus,
    PROFILE_AUXILIARY_ROUTE_MENUS,
  );
  if (!shouldAppendInvestmentRadarRouteMenus(normalizedMenus)) {
    return normalizedMenus;
  }
  const withRadarMenus = appendRouteMenus(
    normalizedMenus,
    INVESTMENT_RADAR_AUXILIARY_ROUTE_MENUS,
  );
  return appendChildRouteMenus(
    withRadarMenus,
    {
      name: 'Investment',
      path: '/investment',
    },
    INVESTMENT_MOBILE_APP_ROUTE_MENUS,
  );
}

export {
  INVESTMENT_MOBILE_APP_ROUTE_MENUS,
  INVESTMENT_RADAR_AUXILIARY_ROUTE_MENUS,
  PROFILE_AUXILIARY_ROUTE_MENUS,
};

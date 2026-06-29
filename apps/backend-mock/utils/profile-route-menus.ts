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

const PROFILE_MEMBERSHIP_WORKBENCH_ROUTE = {
  authCode: 'profile:vip-membership',
  component: '/profile/vip-membership',
  meta: {
    activePath: '/profile',
    hideInMenu: true,
    icon: 'mdi:account-group-outline',
    isApp: true,
    order: 2,
    title: '创建内部团队',
  },
  name: 'ProfileVipMembership',
  path: '/profile/vip-membership',
  type: 'menu',
} as const;

const PROFILE_ORGANIZATION_INVITATION_WORKBENCH_ROUTE = {
  authCode: 'profile:organization-invitations',
  component: '/profile/organization-invitations',
  meta: {
    activePath: '/profile',
    hideInMenu: true,
    icon: 'mdi:ticket-confirmation-outline',
    isApp: true,
    order: 3,
    title: '生成邀请码',
  },
  name: 'ProfileOrganizationInvitations',
  path: '/profile/organization-invitations',
  type: 'menu',
} as const;

const INVESTMENT_PUBLIC_CRAWL_ROOT_ROUTE = {
  authCode: 'investment:public-crawl',
  component: 'BasicLayout',
  meta: {
    icon: 'lucide:briefcase-business',
    order: 2,
    title: '招商管理',
  },
  name: 'InvestmentPublicCrawl',
  path: '/investment-public-crawl',
  redirect: '/investment/radar-factory-listings',
  type: 'menu',
} as const;

const INVESTMENT_PC_ROUTE_MENUS = [
  {
    authCode: 'investment:agent',
    component: '/investment/agent/list',
    meta: {
      activePath: '/investment',
      hideInMenu: true,
      icon: 'mdi:account-tie',
      order: 1,
      title: '招商管理',
    },
    name: 'InvestmentAgent',
    path: '/investment/agent',
    type: 'menu',
  },
] as const;

const CRM_CUSTOMER_ACQUISITION_ROUTE_MENU = {
  authCode: 'crm:qrcode-test',
  component: '/crm/qrcode-test',
  meta: {
    activePath: '/investment',
    hideInMenu: false,
    icon: 'mdi:account-plus-outline',
    isApp: true,
    order: 55,
    title: '获客推广',
  },
  name: 'CrmQrcodeTest',
  path: '/crm/qrcode-test',
  type: 'menu',
} as const;

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
      order: 50,
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
      order: 60,
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
      isApp: false,
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
      isApp: false,
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
      isApp: false,
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
      isApp: false,
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
      isApp: false,
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
      isApp: false,
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
      isApp: false,
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

type InvestmentAuxiliaryScope = 'full' | 'publicCrawlOnly' | 'registrationOnly';

const PUBLIC_CRAWL_ROUTE_NAMES = new Set([
  'InvestmentRadarFactoryListings',
  'InvestmentRadarPublicDemands',
]);

const PUBLIC_CRAWL_ROUTE_PATHS = new Set([
  '/investment/radar-factory-listings',
  '/investment/radar-public-demands',
]);

const PUBLIC_CRAWL_MOBILE_ROUTE_NAMES = new Set([
  'CrmQrcodeTest',
  'InvestmentRadarMobileFactoryListings',
  'InvestmentRadarMobilePublicDemands',
]);

function isRouteInSet(
  route: any,
  names: ReadonlySet<string>,
  paths: ReadonlySet<string>,
) {
  return (
    names.has(String(route?.name || '')) || paths.has(String(route?.path || ''))
  );
}

const PUBLIC_CRAWL_AUXILIARY_ROUTE_MENUS = [
  ...INVESTMENT_RADAR_AUXILIARY_ROUTE_MENUS.filter((route) =>
    isRouteInSet(route, PUBLIC_CRAWL_ROUTE_NAMES, PUBLIC_CRAWL_ROUTE_PATHS),
  ),
  CRM_CUSTOMER_ACQUISITION_ROUTE_MENU,
].map((route) => ({
  ...route,
  meta: {
    ...route.meta,
    activePath: INVESTMENT_PUBLIC_CRAWL_ROOT_ROUTE.path,
    hideInMenu: false,
  },
}));

const PUBLIC_CRAWL_MOBILE_ROUTE_MENUS = [
  ...INVESTMENT_MOBILE_APP_ROUTE_MENUS,
  CRM_CUSTOMER_ACQUISITION_ROUTE_MENU,
].filter((route) => PUBLIC_CRAWL_MOBILE_ROUTE_NAMES.has(route.name));

const REGISTRATION_MOBILE_ROUTE_NAMES = new Set([
  'InvestmentAgentMobileList',
  ...PUBLIC_CRAWL_MOBILE_ROUTE_NAMES,
]);

const REGISTRATION_MOBILE_ROUTE_MENUS = [
  ...INVESTMENT_MOBILE_APP_ROUTE_MENUS,
  CRM_CUSTOMER_ACQUISITION_ROUTE_MENU,
].filter((route) => REGISTRATION_MOBILE_ROUTE_NAMES.has(route.name));

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

function isDashboardRoute(route: any) {
  return route?.name === 'Dashboard' || route?.path === '/dashboard';
}

function isProfileMembershipRoute(route: any) {
  return (
    route?.name === PROFILE_MEMBERSHIP_WORKBENCH_ROUTE.name ||
    route?.path === PROFILE_MEMBERSHIP_WORKBENCH_ROUTE.path
  );
}

function isProfileOrganizationInvitationRoute(route: any) {
  return (
    route?.name === PROFILE_ORGANIZATION_INVITATION_WORKBENCH_ROUTE.name ||
    route?.path === PROFILE_ORGANIZATION_INVITATION_WORKBENCH_ROUTE.path
  );
}

function buildProfileMembershipWorkbenchRoute(source?: any) {
  return {
    ...PROFILE_MEMBERSHIP_WORKBENCH_ROUTE,
    ...source,
    meta: {
      ...source?.meta,
      ...PROFILE_MEMBERSHIP_WORKBENCH_ROUTE.meta,
    },
  };
}

function buildProfileOrganizationInvitationWorkbenchRoute(source?: any) {
  return {
    ...PROFILE_ORGANIZATION_INVITATION_WORKBENCH_ROUTE,
    ...source,
    meta: {
      ...source?.meta,
      ...PROFILE_ORGANIZATION_INVITATION_WORKBENCH_ROUTE.meta,
    },
  };
}

function moveProfileMembershipRouteToDashboard(menus: any[]) {
  let sourceRoute: any;

  const stripProfileMembershipRoute = (items: any[]): any[] =>
    items.flatMap((item) => {
      if (isProfileMembershipRoute(item)) {
        sourceRoute ||= item;
        return [];
      }

      if (!Array.isArray(item?.children) || item.children.length === 0) {
        return [item];
      }

      const children = stripProfileMembershipRoute(item.children);
      return [
        {
          ...item,
          ...(children.length > 0 ? { children } : { children: undefined }),
        },
      ];
    });

  const strippedMenus = stripProfileMembershipRoute(menus);
  const route = buildProfileMembershipWorkbenchRoute(sourceRoute);
  let dashboardFound = false;

  const appendToDashboard = (items: any[]): any[] =>
    items.map((item) => {
      if (isDashboardRoute(item)) {
        dashboardFound = true;
        return {
          ...item,
          children: sortRouteMenusByOrder(
            appendRouteMenus(
              Array.isArray(item.children) ? item.children : [],
              [route],
            ),
          ),
        };
      }

      if (Array.isArray(item?.children) && item.children.length > 0) {
        return {
          ...item,
          children: appendToDashboard(item.children),
        };
      }

      return item;
    });

  const nextMenus = appendToDashboard(strippedMenus);
  return dashboardFound ? nextMenus : appendRouteMenus(nextMenus, [route]);
}

function moveProfileOrganizationInvitationRouteToDashboard(menus: any[]) {
  let sourceRoute: any;

  const stripProfileOrganizationInvitationRoute = (items: any[]): any[] =>
    items.flatMap((item) => {
      if (isProfileOrganizationInvitationRoute(item)) {
        sourceRoute ||= item;
        return [];
      }

      if (!Array.isArray(item?.children) || item.children.length === 0) {
        return [item];
      }

      const children = stripProfileOrganizationInvitationRoute(item.children);
      return [
        {
          ...item,
          ...(children.length > 0 ? { children } : { children: undefined }),
        },
      ];
    });

  const strippedMenus = stripProfileOrganizationInvitationRoute(menus);
  const route = buildProfileOrganizationInvitationWorkbenchRoute(sourceRoute);
  let dashboardFound = false;

  const appendToDashboard = (items: any[]): any[] =>
    items.map((item) => {
      if (isDashboardRoute(item)) {
        dashboardFound = true;
        return {
          ...item,
          children: sortRouteMenusByOrder(
            appendRouteMenus(
              Array.isArray(item.children) ? item.children : [],
              [route],
            ),
          ),
        };
      }

      if (Array.isArray(item?.children) && item.children.length > 0) {
        return {
          ...item,
          children: appendToDashboard(item.children),
        };
      }

      return item;
    });

  const nextMenus = appendToDashboard(strippedMenus);
  return dashboardFound ? nextMenus : appendRouteMenus(nextMenus, [route]);
}

function getRouteKey(route: any) {
  return String(route?.name || route?.path || '');
}

function getRouteOrder(route: any) {
  const order = Number(route?.meta?.order);
  return Number.isFinite(order) ? order : 999;
}

function sortRouteMenusByOrder(menus: any[]) {
  return [...menus].sort((a, b) => getRouteOrder(a) - getRouteOrder(b));
}

function placeRouteMenusAfter(
  menus: any[],
  anchorRouteNames: readonly string[],
  routeNames: readonly string[],
) {
  const routeNameSet = new Set(routeNames);
  const routesToPlace = menus.filter((route) =>
    routeNameSet.has(getRouteKey(route)),
  );
  if (routesToPlace.length === 0) {
    return menus;
  }

  const remainingRoutes = menus.filter(
    (route) => !routeNameSet.has(getRouteKey(route)),
  );
  const anchorIndex = remainingRoutes.findIndex((route) =>
    anchorRouteNames.includes(getRouteKey(route)),
  );
  if (anchorIndex === -1) {
    return menus;
  }

  return [
    ...remainingRoutes.slice(0, anchorIndex + 1),
    ...routesToPlace,
    ...remainingRoutes.slice(anchorIndex + 1),
  ];
}

function sortInvestmentChildRouteMenus(menus: any[]) {
  return placeRouteMenusAfter(
    sortRouteMenusByOrder(menus),
    ['InvestmentRadarPublicDemands'],
    ['CrmQrcodeTest'],
  );
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
          children: sortInvestmentChildRouteMenus(
            appendRouteMenus(
              Array.isArray(item.children) ? item.children : [],
              routes,
            ),
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

function buildPublicCrawlRootRoute(children: readonly any[]) {
  return {
    ...INVESTMENT_PUBLIC_CRAWL_ROOT_ROUTE,
    children: sortInvestmentChildRouteMenus(appendRouteMenus([], children)),
  };
}

function shouldAppendInvestmentRadarRouteMenus(menus: any[]) {
  return (
    hasRouteMenu(menus, {
      name: 'Investment',
      path: '/investment',
    }) ||
    hasRouteMenu(menus, {
      name: 'InvestmentAgent',
      path: '/investment/agent',
    }) ||
    hasRouteMenu(menus, {
      name: 'InvestmentRadar',
      path: '/investment/radar',
    })
  );
}

export function appendProfileAuxiliaryRouteMenus(
  menus: any[],
  options: {
    ensureCustomerAcquisition?: boolean;
    investmentScope?: InvestmentAuxiliaryScope;
    showOrganizationInvitationWorkbench?: boolean;
  } = {},
) {
  let normalizedMenus = moveProfileMembershipRouteToDashboard(
    appendRouteMenus(menus, PROFILE_AUXILIARY_ROUTE_MENUS),
  );
  if (options.showOrganizationInvitationWorkbench) {
    normalizedMenus =
      moveProfileOrganizationInvitationRouteToDashboard(normalizedMenus);
  }

  if (options.investmentScope === 'publicCrawlOnly') {
    const publicCrawlRouteMenus = [
      ...PUBLIC_CRAWL_AUXILIARY_ROUTE_MENUS,
      ...PUBLIC_CRAWL_MOBILE_ROUTE_MENUS,
    ];
    return appendRouteMenus(normalizedMenus, [
      buildPublicCrawlRootRoute(publicCrawlRouteMenus),
    ]);
  }

  if (options.investmentScope === 'registrationOnly') {
    const registrationRouteMenus = [
      ...PUBLIC_CRAWL_AUXILIARY_ROUTE_MENUS,
      ...REGISTRATION_MOBILE_ROUTE_MENUS,
    ];
    return appendRouteMenus(normalizedMenus, [
      buildPublicCrawlRootRoute(registrationRouteMenus),
    ]);
  }

  let routeMenus = normalizedMenus;
  if (
    options.ensureCustomerAcquisition &&
    !shouldAppendInvestmentRadarRouteMenus(routeMenus)
  ) {
    routeMenus = appendRouteMenus(routeMenus, [
      buildPublicCrawlRootRoute([
        ...PUBLIC_CRAWL_AUXILIARY_ROUTE_MENUS,
        ...PUBLIC_CRAWL_MOBILE_ROUTE_MENUS,
      ]),
    ]);
  }

  if (!shouldAppendInvestmentRadarRouteMenus(routeMenus)) {
    return routeMenus;
  }

  const withRadarMenus = appendRouteMenus(
    routeMenus,
    INVESTMENT_RADAR_AUXILIARY_ROUTE_MENUS,
  );
  return appendChildRouteMenus(
    withRadarMenus,
    {
      name: 'Investment',
      path: '/investment',
    },
    [
      ...INVESTMENT_PC_ROUTE_MENUS,
      CRM_CUSTOMER_ACQUISITION_ROUTE_MENU,
      ...INVESTMENT_MOBILE_APP_ROUTE_MENUS,
    ],
  );
}

export {
  CRM_CUSTOMER_ACQUISITION_ROUTE_MENU,
  INVESTMENT_MOBILE_APP_ROUTE_MENUS,
  INVESTMENT_PC_ROUTE_MENUS,
  INVESTMENT_RADAR_AUXILIARY_ROUTE_MENUS,
  PROFILE_AUXILIARY_ROUTE_MENUS,
  PUBLIC_CRAWL_AUXILIARY_ROUTE_MENUS,
};

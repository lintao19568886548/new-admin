import { prismaClient, systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { normalizeParkManagementMenuPlacement } from '~/utils/park-menu-placement';
import { appendProfileAuxiliaryRouteMenus } from '~/utils/profile-route-menus';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { processMenuData } from '~/utils/tools';
import { getVipMembershipAccessState } from '~/utils/vip-membership';

const MEMBERSHIP_RESTRICTED_ROUTE_MENUS = [
  {
    authCode: 'dashboard:home',
    component: '/dashboard/index',
    meta: {
      hideInMenu: true,
      icon: 'lucide:home',
      title: '首页',
    },
    name: 'Home',
    path: '/home',
    type: 'menu',
  },
  {
    authCode: 'dashboard:workbench',
    component: '/dashboard/workbench/index',
    meta: {
      hideInMenu: true,
      icon: 'carbon:workspace',
      title: '工作台',
    },
    name: 'Workbench',
    path: '/workbench',
    type: 'menu',
  },
  {
    authCode: 'profile:index',
    component: '/profile/index',
    meta: {
      hideInMenu: true,
      icon: 'mdi:account-circle-outline',
      title: '我的',
    },
    name: 'Profile',
    path: '/profile',
    type: 'menu',
  },
  {
    authCode: 'rental:manage',
    component: '/rental/manage/list',
    meta: {
      hideInMenu: true,
      icon: 'mdi:clipboard-list',
      title: '租赁管理',
    },
    name: 'RentalManage',
    path: '/rental/manage',
    type: 'menu',
  },
  {
    authCode: 'rental:manage-mobile',
    component: '/rental/manage/mobile',
    meta: {
      hideInMenu: true,
      icon: 'mdi:cellphone-cog',
      title: '租赁管理',
    },
    name: 'RentalManageMobile',
    path: '/rental/manage/mobile',
    type: 'menu',
  },
  {
    authCode: 'system:park',
    component: '/system/park/list',
    meta: {
      hideInMenu: true,
      icon: 'mdi:office-building-cog-outline',
      title: '园区管理',
    },
    name: 'SystemPark',
    path: '/system/park',
    type: 'menu',
  },
  {
    authCode: 'system:park-mobile',
    component: '/rental/manage/mobile',
    meta: {
      hideInMenu: true,
      icon: 'mdi:cellphone-cog',
      title: '园区管理',
    },
    name: 'SystemParkMobile',
    path: '/system/park/mobile',
    type: 'menu',
  },
  {
    authCode: 'hrm:information',
    component: '/hrm/information/list',
    meta: {
      hideInMenu: true,
      icon: 'mdi:account-group-outline',
      title: '人员信息',
    },
    name: 'HrmInformation',
    path: '/hrm/information',
    type: 'menu',
  },
  {
    authCode: 'hrm:mobile-information',
    component: '/hrm/information/mobile-list',
    meta: {
      hideInMenu: true,
      icon: 'mdi:cellphone-account',
      title: '人员信息',
    },
    name: 'HrmMobileInformation',
    path: '/hrm/mobile-information',
    type: 'menu',
  },
  {
    authCode: 'hrm:information-mobile',
    component: '/hrm/information/mobile-list',
    meta: {
      hideInMenu: true,
      icon: 'mdi:cellphone-account',
      title: '人员信息',
    },
    name: 'HrmInformationMobile',
    path: '/hrm/information/mobile',
    type: 'menu',
  },
] as const;

const APP_SHELL_ROUTE_MENUS = [
  {
    authCode: 'dashboard:home',
    component: '/dashboard/index',
    meta: {
      hideInMenu: true,
      icon: 'lucide:home',
      title: '首页',
    },
    name: 'Home',
    path: '/home',
    type: 'menu',
  },
  {
    authCode: 'dashboard:workbench',
    component: '/dashboard/workbench/index',
    meta: {
      hideInMenu: true,
      icon: 'carbon:workspace',
      title: '工作台',
    },
    name: 'Workbench',
    path: '/workbench',
    type: 'menu',
  },
  {
    authCode: 'profile:index',
    component: '/profile/index',
    meta: {
      hideInMenu: true,
      icon: 'mdi:account-circle-outline',
      title: '我的',
    },
    name: 'Profile',
    path: '/profile',
    type: 'menu',
  },
] as const;

const BILL_ROUTE_MENUS = [
  {
    authCode: 'bill:amount',
    component: '/bill/amount/list',
    meta: {
      icon: 'mdi:file-document-multiple',
      order: -1,
      title: '账单管理',
    },
    name: 'Bill',
    path: '/bill',
    type: 'menu',
  },
] as const;

const LOCAL_AGENT_ROUTE_MENUS = [
  {
    authCode: null,
    component: '',
    meta: {
      icon: 'lucide:bot',
      order: 2,
      title: 'AI工具集',
    },
    name: 'Tools',
    path: '/tools',
    redirect: '/tools/agent-workbench',
    type: 'catalog',
  },
  {
    authCode: 'agent:workbench',
    component: '/dashboard/agent-workbench/index',
    meta: {
      icon: 'lucide:messages-square',
      order: 1,
      title: 'Agent工作台',
    },
    name: 'AgentWorkbench',
    path: '/tools/agent-workbench',
    type: 'menu',
  },
  {
    authCode: 'tools:webtools',
    component: '/tools/webtools',
    meta: {
      icon: 'lucide:panel-top',
      order: 2,
      title: 'AI工具导航',
    },
    name: 'AiToolsWebtools',
    path: '/tools/webtools',
    type: 'menu',
  },
  {
    authCode: 'agent:tasks',
    component: '/agent/task-list',
    meta: {
      icon: 'lucide:list-checks',
      order: 3,
      title: '任务中心',
    },
    name: 'AgentTaskCenter',
    path: '/tools/agent-tasks',
    type: 'menu',
  },
  {
    authCode: 'agent:tasks',
    component: '/agent/task-detail',
    meta: {
      activePath: '/tools/agent-tasks',
      hideInMenu: true,
      icon: 'lucide:file-search',
      order: 3.1,
      title: '任务详情',
    },
    name: 'AgentTaskDetail',
    path: '/tools/agent-tasks/detail',
    type: 'menu',
  },
  {
    authCode: 'agent:skills',
    component: '/agent/skill-center',
    meta: {
      icon: 'lucide:blocks',
      order: 4,
      title: 'Skill中心',
    },
    name: 'AgentSkillCenter',
    path: '/tools/agent-skills',
    type: 'menu',
  },
  {
    authCode: 'agent:models',
    component: '/agent/model-config',
    meta: {
      icon: 'lucide:sliders-horizontal',
      order: 5,
      title: '模型配置',
    },
    name: 'AgentModelConfig',
    path: '/tools/agent-models',
    type: 'menu',
  },
] as const;

const MOBILE_COMPATIBILITY_ROUTE_MENUS = [
  {
    route: {
      authCode: 'bill:amount-mobile',
      component: '/bill/amount/mobile-list',
      meta: {
        activePath: '/bill',
        hideInMenu: true,
        icon: 'mdi:cellphone',
        title: '账单管理',
      },
      name: 'BillMobileList',
      path: '/bill/mobile-list',
      type: 'menu',
    },
    sources: [{ name: 'Bill', path: '/bill' }],
  },
  {
    route: {
      authCode: 'finance:manage-mobile',
      component: '/finance/manage/mobile-list',
      meta: {
        activePath: '/finance/manage',
        hideInMenu: true,
        icon: 'mdi:cellphone-text',
        title: '财务管理',
      },
      name: 'FinanceMobileManage',
      path: '/finance/mobile-manage',
      type: 'menu',
    },
    sources: [
      { name: 'FinanceManage', path: '/finance/manage' },
      { name: 'Finance', path: '/finance' },
    ],
  },
  {
    route: {
      authCode: 'rental:tenant-mobile',
      component: '/rental/tenant/mobile-list',
      meta: {
        activePath: '/rental/tenant',
        hideInMenu: true,
        icon: 'mdi:cellphone-account',
        title: '租户管理',
      },
      name: 'TenantMobileList',
      path: '/rental/tenant/mobile',
      type: 'menu',
    },
    sources: [{ name: 'TenantManage', path: '/rental/tenant' }],
  },
  {
    route: {
      authCode: 'rental:manage-mobile',
      component: '/rental/manage/mobile',
      meta: {
        activePath: '/rental/manage',
        hideInMenu: true,
        icon: 'mdi:cellphone-cog',
        title: '园区管理',
      },
      name: 'RentalManageMobile',
      path: '/rental/manage/mobile',
      type: 'menu',
    },
    sources: [{ name: 'RentalManage', path: '/rental/manage' }],
  },
  {
    route: {
      authCode: 'system:park-mobile',
      component: '/rental/manage/mobile',
      meta: {
        activePath: '/system/park',
        hideInMenu: true,
        icon: 'mdi:cellphone-cog',
        title: '园区管理',
      },
      name: 'SystemParkMobile',
      path: '/system/park/mobile',
      type: 'menu',
    },
    sources: [{ name: 'SystemPark', path: '/system/park' }],
  },
  {
    route: {
      authCode: 'rental:settled-mobile',
      component: '/rental/settled/mobile-list',
      meta: {
        activePath: '/rental/settled',
        hideInMenu: true,
        icon: 'mdi:cellphone-home',
        title: '入驻厂房',
      },
      name: 'SettledFactoryMobile',
      path: '/rental/settled/mobile',
      type: 'menu',
    },
    sources: [{ name: 'SettledFactory', path: '/rental/settled' }],
  },
  {
    route: {
      authCode: 'rental:reading-mobile',
      component: '/rental/reading/mobile',
      meta: {
        activePath: '/rental/reading/mobile',
        hideInMenu: true,
        icon: 'mdi:cellphone-text',
        title: '水电表抄表数据',
      },
      name: 'ReadingMobile',
      path: '/rental/reading/mobile',
      type: 'menu',
    },
    sources: [
      { name: 'MeterList', path: '/rental/meter' },
      { name: 'WaterList', path: '/rental/water' },
    ],
  },
  {
    route: {
      authCode: 'hrm:mobile-information',
      component: '/hrm/information/mobile-list',
      meta: {
        activePath: '/hrm/information',
        hideInMenu: true,
        icon: 'mdi:cellphone-account',
        title: '员工信息',
      },
      name: 'HrmMobileInformation',
      path: '/hrm/mobile-information',
      type: 'menu',
    },
    sources: [{ name: 'HrmInformation', path: '/hrm/information' }],
  },
  {
    route: {
      authCode: 'hrm:leaveapplication-mobile',
      component: '/hrm/leaveapplication/mobile-list',
      meta: {
        activePath: '/hrm/leaveapplication',
        hideInMenu: true,
        icon: 'mdi:cellphone-text',
        title: '请假申请',
      },
      name: 'HrmLeaveApplicationMobile',
      path: '/hrm/leavemobile',
      type: 'menu',
    },
    sources: [{ name: 'HrmLeaveApplication', path: '/hrm/leaveapplication' }],
  },
  {
    route: {
      authCode: 'reimbursement:application-mobile',
      component: '/reimbursement/application/mobile',
      meta: {
        activePath: '/reimbursement/application',
        hideInMenu: true,
        icon: 'mdi:cellphone-check',
        title: '报销申请',
      },
      name: 'ReimbursementMobileApply',
      path: '/reimbursement/mobile-apply',
      type: 'menu',
    },
    sources: [
      { name: 'ReimbursementApplication', path: '/reimbursement/application' },
    ],
  },
  {
    route: {
      authCode: 'reimbursement:audit-mobile',
      component: '/reimbursement/audit/mobile',
      meta: {
        activePath: '/reimbursement/audit',
        hideInMenu: true,
        icon: 'mdi:cellphone-text',
        title: '报销审核',
      },
      name: 'ReimbursementMobileAudit',
      path: '/reimbursement/mobile-audit',
      type: 'menu',
    },
    sources: [{ name: 'ReimbursementAudit', path: '/reimbursement/audit' }],
  },
  {
    route: {
      authCode: 'notices:mobile',
      component: '/notices/mobile-list',
      meta: {
        activePath: '/notices',
        hideInMenu: true,
        icon: 'mdi:bullhorn-outline',
        title: '公告列表',
      },
      name: 'NoticesMobile',
      path: '/notices/mobile',
      type: 'menu',
    },
    sources: [{ name: 'Notices', path: '/notices' }],
  },
  {
    route: {
      authCode: 'access:visitor-mobile',
      component: '/access/visitor/mobile-list',
      meta: {
        activePath: '/access/visitor',
        hideInMenu: true,
        icon: 'carbon:mobile',
        title: '访客管理',
      },
      name: 'VisitorMobileList',
      path: '/access/visitor/mobile',
      type: 'menu',
    },
    sources: [{ name: 'VisitorAccess', path: '/access/visitor' }],
  },
  {
    route: {
      authCode: 'maintenance:firefighting-mobile',
      component: '/maintenance/firefighting/mobile-list',
      meta: {
        activePath: '/maintenance/firefighting',
        hideInMenu: true,
        icon: 'mdi:fire-extinguisher',
        title: '消防管理',
      },
      name: 'FirefightingMobile',
      path: '/maintenance/firefighting/mobile',
      type: 'menu',
    },
    sources: [{ name: 'Firefighting', path: '/maintenance/firefighting' }],
  },
  {
    route: {
      authCode: 'maintenance:elevator-mobile',
      component: '/maintenance/elevator/mobile-list',
      meta: {
        activePath: '/maintenance/elevator',
        hideInMenu: true,
        icon: 'mdi:elevator',
        title: '电梯管理',
      },
      name: 'ElevatorMobile',
      path: '/maintenance/elevator/mobile',
      type: 'menu',
    },
    sources: [{ name: 'Elevator', path: '/maintenance/elevator' }],
  },
  {
    route: {
      authCode: 'maintenance:factory-maint-mobile',
      component: '/maintenance/factoryMaint/mobile-list',
      meta: {
        activePath: '/maintenance/factoryMaint',
        hideInMenu: true,
        icon: 'mdi:office-building-cog',
        title: '厂房维护',
      },
      name: 'FactoryMaintMobile',
      path: '/maintenance/factoryMaint/mobile',
      type: 'menu',
    },
    sources: [{ name: 'FactoryMaint', path: '/maintenance/factoryMaint' }],
  },
  {
    route: {
      authCode: 'maintenance:transformer-mobile',
      component: '/maintenance/transformer/mobile-list',
      meta: {
        activePath: '/maintenance/transformer',
        hideInMenu: true,
        icon: 'mdi:lightning-bolt',
        title: '变压器维保',
      },
      name: 'TransformerMobile',
      path: '/maintenance/transformer/mobile',
      type: 'menu',
    },
    sources: [{ name: 'Transformer', path: '/maintenance/transformer' }],
  },
  {
    route: {
      authCode: 'maintenance:hygiene-check-mobile',
      component: '/maintenance/hygieneCheck/mobile-list',
      meta: {
        activePath: '/maintenance/hygieneCheck',
        hideInMenu: true,
        icon: 'mdi:broom',
        title: '卫生检查',
      },
      name: 'HygieneCheckMobile',
      path: '/maintenance/hygieneCheck/mobile',
      type: 'menu',
    },
    sources: [{ name: 'HygieneCheck', path: '/maintenance/hygieneCheck' }],
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

function appendBillRouteMenus(menus: any[]) {
  return appendRouteMenus(menus, BILL_ROUTE_MENUS);
}

function appendAppShellRouteMenus(menus: any[]) {
  return appendRouteMenus(menus, APP_SHELL_ROUTE_MENUS);
}

function appendAccessibleMobileRouteMenus(menus: any[]) {
  const routes = MOBILE_COMPATIBILITY_ROUTE_MENUS.filter((entry) =>
    entry.sources.some((source) => hasRouteMenu(menus, source)),
  ).map((entry) => entry.route);
  return appendRouteMenus(menus, routes);
}

function isInvestmentRoute(menu: any) {
  const path = String(menu?.path || '');
  const authCode = String(menu?.authCode || '');
  const name = String(menu?.name || '');
  return (
    path === '/investment' ||
    path.startsWith('/investment/') ||
    authCode.startsWith('investment:') ||
    name.startsWith('Investment')
  );
}

function filterInvestmentPublicCrawlMenus(menus: any[]) {
  const visit = (items: any[]): any[] => {
    const result: any[] = [];
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const investmentRoute = isInvestmentRoute(item);
      if (investmentRoute) {
        continue;
      }

      const children = Array.isArray(item.children) ? visit(item.children) : [];

      result.push({
        ...item,
        ...(children.length > 0 ? { children } : {}),
      });
    }
    return result;
  };

  return visit(menus);
}

async function isMembershipRestrictedUser(userinfo: {
  centerUserId?: unknown;
  customerId?: unknown;
  id?: unknown;
}) {
  const defaultCustomerId = String(
    process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  const currentCustomerId = String(userinfo.customerId || defaultCustomerId);
  if (currentCustomerId === defaultCustomerId) {
    return false;
  }

  const centerUserId = Number(userinfo.centerUserId ?? userinfo.id);
  if (!Number.isFinite(centerUserId) || centerUserId <= 0) {
    return false;
  }

  const centerUser = await systemDbClient.user.findUnique({
    select: {
      createTime: true,
      customerType: true,
      membershipTrialStartAt: true,
    },
    where: { id: centerUserId },
  });
  if (
    !centerUser ||
    String(centerUser.customerType || '') !== currentCustomerId
  ) {
    return false;
  }

  const accessState = await getVipMembershipAccessState({
    centerUserId,
    centerUserCreateTime: centerUser.createTime || null,
    centerUserTrialStartAt: centerUser.membershipTrialStartAt || null,
    customerId: currentCustomerId,
  });
  return accessState.accessRestricted;
}

const INVESTMENT_REGISTRATION_USERNAMES = new Set([
  '18127933306',
  '18689459979',
]);

async function appendMembershipRouteMenus(
  menus: any[],
  userinfo: any,
  options: {
    hasInvestmentRegistrationAccess?: boolean;
    hasSuperRole: boolean;
  },
) {
  let investmentScope: 'full' | 'publicCrawlOnly' | 'registrationOnly' =
    'publicCrawlOnly';
  if (options.hasSuperRole) {
    investmentScope = 'full';
  } else if (options.hasInvestmentRegistrationAccess) {
    investmentScope = 'registrationOnly';
  }
  const scopedMenus = options.hasSuperRole
    ? menus
    : filterInvestmentPublicCrawlMenus(menus);
  const baseMenus = appendProfileAuxiliaryRouteMenus(scopedMenus, {
    ensureCustomerAcquisition: true,
    investmentScope,
    showOrganizationInvitationWorkbench:
      Boolean(userinfo.customerId) &&
      !['default', 'public'].includes(String(userinfo.customerId)),
  });
  if (!(await isMembershipRestrictedUser(userinfo))) {
    return appendAccessibleMobileRouteMenus(
      appendAppShellRouteMenus(baseMenus),
    );
  }

  return appendRouteMenus(
    appendAccessibleMobileRouteMenus(appendAppShellRouteMenus(baseMenus)),
    MEMBERSHIP_RESTRICTED_ROUTE_MENUS,
  );
}

function normalizeMenuPath(value: unknown) {
  const path = String(value || '').trim();
  if (!path || path === '/') {
    return path || '';
  }
  return path.replace(/\/+$/, '') || '/';
}

function isRouteMenu(
  menu: any,
  route: {
    name: string;
    path: string;
  },
) {
  return (
    menu?.name === route.name || normalizeMenuPath(menu?.path) === route.path
  );
}

function moveRouteBefore(
  menus: any[],
  source: {
    name: string;
    path: string;
  },
  target: {
    name: string;
    path: string;
  },
) {
  const sourceIndex = menus.findIndex((menu) => isRouteMenu(menu, source));
  const targetIndex = menus.findIndex((menu) => isRouteMenu(menu, target));
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex < targetIndex) {
    return menus;
  }

  const nextMenus = [...menus];
  const [sourceMenu] = nextMenus.splice(sourceIndex, 1);
  nextMenus.splice(targetIndex, 0, sourceMenu);
  return nextMenus;
}

function normalizeSystemChildMenuPlacement(menus: any[]): any[] {
  return menus.map((menu) => {
    const children = Array.isArray(menu?.children)
      ? normalizeSystemChildMenuPlacement(menu.children)
      : undefined;
    const nextMenu = children ? { ...menu, children } : menu;

    if (
      isRouteMenu(nextMenu, { name: 'System', path: '/system' }) &&
      Array.isArray(nextMenu.children)
    ) {
      return {
        ...nextMenu,
        children: moveRouteBefore(
          nextMenu.children,
          { name: 'SystemUser', path: '/system/user' },
          { name: 'SystemRole', path: '/system/role' },
        ),
      };
    }

    return nextMenu;
  });
}

function isAgentWorkbenchMenu(menu: any) {
  return (
    isRouteMenu(menu, {
      name: 'AgentWorkbench',
      path: '/tools/agent-workbench',
    }) || isRouteMenu(menu, { name: 'Workspace', path: '/workspace' })
  );
}

function isAiToolsMenu(menu: any) {
  return isRouteMenu(menu, { name: 'Tools', path: '/tools' });
}

function isAiToolsWebtoolsMenu(menu: any) {
  return isRouteMenu(menu, {
    name: 'AiToolsWebtools',
    path: '/tools/webtools',
  });
}

function isAiToolsChildMenu(menu: any) {
  const path = normalizeMenuPath(menu?.path);
  return path.startsWith('/tools/') && !isAiToolsMenu(menu);
}

function buildAgentWorkbenchRoute(
  source: any,
  options: { exposeLocalAgentMenus: boolean },
) {
  return {
    ...source,
    authCode: source?.authCode || 'agent:workbench',
    component: '/dashboard/agent-workbench/index',
    meta: {
      ...source?.meta,
      hideInMenu: !options.exposeLocalAgentMenus,
      icon: 'lucide:messages-square',
      order: 1,
      title: 'Agent工作台',
    },
    name: 'AgentWorkbench',
    path: '/tools/agent-workbench',
    type: 'menu',
  };
}

function buildAiToolsWebtoolsRoute(
  source: any,
  options: { exposeLocalAgentMenus: boolean },
) {
  return {
    ...source,
    authCode: source?.authCode || 'tools:webtools',
    component: source?.component || '/tools/webtools',
    meta: {
      ...source?.meta,
      hideInMenu: !options.exposeLocalAgentMenus,
      icon: source?.meta?.icon || 'lucide:panel-top',
      order: 1,
      title: 'AI工具导航',
    },
    name: 'AiToolsWebtools',
    path: '/tools/webtools',
    type: 'menu',
  };
}

function buildAiToolsCatalog(
  source: any,
  children: any[],
  options: { exposeLocalAgentMenus: boolean },
) {
  const normalizedChildren = children.map((child) => {
    if (options.exposeLocalAgentMenus || child?.meta?.hideInMenu === true) {
      return child;
    }

    return {
      ...child,
      meta: {
        ...child?.meta,
        hideInMenu: true,
      },
    };
  });

  return {
    ...source,
    component: undefined,
    meta: {
      ...source?.meta,
      hideInMenu: !options.exposeLocalAgentMenus,
      icon: 'lucide:bot',
      order: 2,
      title: 'AI工具集',
    },
    name: 'Tools',
    path: '/tools',
    redirect: '/tools/agent-workbench',
    type: 'catalog',
    children: sortMenusByMetaOrder(normalizedChildren),
  };
}

function sortMenusByMetaOrder(menus: any[]) {
  return [...menus].sort((a, b) => {
    const aOrder = Number(a?.meta?.order ?? 9999);
    const bOrder = Number(b?.meta?.order ?? 9999);
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return String(a?.meta?.title || a?.name || '').localeCompare(
      String(b?.meta?.title || b?.name || ''),
      'zh-Hans-CN',
    );
  });
}

function removeAiToolsMenus(
  menus: any[],
  collector: {
    agentWorkbench?: any;
    aiTools?: any;
    aiToolsChildren: any[];
    webtools?: any;
  },
): any[] {
  const result: any[] = [];

  for (const menu of menus) {
    if (!menu || typeof menu !== 'object') {
      continue;
    }

    const children = Array.isArray(menu.children)
      ? removeAiToolsMenus(menu.children, collector)
      : [];

    if (isAgentWorkbenchMenu(menu)) {
      collector.agentWorkbench ||= menu;
      continue;
    }

    if (isAiToolsWebtoolsMenu(menu)) {
      collector.webtools ||= menu;
      continue;
    }

    if (isAiToolsChildMenu(menu)) {
      collector.aiToolsChildren.push({
        ...menu,
        ...(children.length > 0 ? { children } : {}),
      });
      continue;
    }

    if (isAiToolsMenu(menu)) {
      collector.aiTools ||= menu;
      if (children.length > 0) {
        collector.aiToolsChildren.push(...children);
      }
      continue;
    }

    result.push({
      ...menu,
      ...(children.length > 0 ? { children } : {}),
    });
  }

  return result;
}

function shouldExposeLocalAgentMenus() {
  const scope = String(process.env.AGENT_MENU_SCOPE || '')
    .trim()
    .toLowerCase();

  if (['hidden', 'online', 'prod', 'production'].includes(scope)) {
    return false;
  }
  if (['dev', 'development', 'local', 'visible'].includes(scope)) {
    return true;
  }

  return process.env.NODE_ENV === 'development';
}

function normalizeAiToolsMenuPlacement(
  menus: any[],
  options: { exposeLocalAgentMenus: boolean },
): any[] {
  const sourceMenus = options.exposeLocalAgentMenus
    ? appendRouteMenus(menus, LOCAL_AGENT_ROUTE_MENUS)
    : menus;
  const collector: {
    agentWorkbench?: any;
    aiTools?: any;
    aiToolsChildren: any[];
    webtools?: any;
  } = {
    aiToolsChildren: [],
  };
  const cleanedMenus = removeAiToolsMenus(sourceMenus, collector);
  if (
    !collector.aiTools &&
    !collector.agentWorkbench &&
    !collector.webtools &&
    collector.aiToolsChildren.length === 0
  ) {
    return cleanedMenus;
  }

  const webtoolsSource =
    collector.webtools ||
    (collector.aiTools?.component ? collector.aiTools : undefined);
  const aiToolsChildren = [
    buildAgentWorkbenchRoute(collector.agentWorkbench, options),
    buildAiToolsWebtoolsRoute(webtoolsSource, options),
    ...collector.aiToolsChildren.filter(
      (item) =>
        !isAgentWorkbenchMenu(item) &&
        !isAiToolsMenu(item) &&
        !isAiToolsWebtoolsMenu(item),
    ),
  ];
  const aiTools = buildAiToolsCatalog(
    collector.aiTools,
    aiToolsChildren,
    options,
  );
  let inserted = false;

  const normalized = cleanedMenus.map((menu) => {
    const children = Array.isArray(menu?.children) ? menu.children : [];

    if (isRouteMenu(menu, { name: 'Dashboard', path: '/dashboard' })) {
      inserted = true;
      return {
        ...menu,
        children: sortMenusByMetaOrder([
          ...children.filter(
            (child: any) =>
              !isAiToolsMenu(child) && !isAgentWorkbenchMenu(child),
          ),
          aiTools,
        ]),
      };
    }

    return menu;
  });

  if (!inserted) {
    normalized.unshift({
      children: [aiTools],
      meta: {
        icon: 'lucide:layout-dashboard',
        order: -9999,
        title: '总台',
      },
      name: 'Dashboard',
      path: '/dashboard',
      type: 'catalog',
    });
  }

  return normalized;
}

function normalizeRouteMenus(
  menus: any[],
  _options: { hasSuperRole: boolean },
) {
  return normalizeSystemChildMenuPlacement(
    normalizeAiToolsMenuPlacement(
      normalizeParkManagementMenuPlacement(menus, {
        ensureParkWhenMissing: false,
        includeCompatibilityRoutes: true,
        includeMobileRoute: true,
        preferLegacyMenu: false,
      }),
      { exposeLocalAgentMenus: shouldExposeLocalAgentMenus() },
    ),
  );
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
            NOT: { name: 'SystemPark' },
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

    const normalizedMenus = normalizeRouteMenus(processedMenus, {
      hasSuperRole,
    });

    return useResponseSuccess(
      await appendMembershipRouteMenus(
        appendBillRouteMenus(normalizedMenus),
        userinfo,
        { hasSuperRole },
      ),
    );
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
  const hasInvestmentRegistrationAccess =
    INVESTMENT_REGISTRATION_USERNAMES.has(String(userinfo.username || '')) &&
    menuIds.length > 0 &&
    (await prismaClient.menu.count({
      where: {
        menuId: {
          in: menuIds,
        },
        OR: [
          {
            name: {
              in: ['InvestmentAgent', 'InvestmentAgentMobileList'],
            },
          },
          {
            path: {
              in: ['/investment/agent', '/investment/mobile'],
            },
          },
          {
            authCode: {
              in: ['investment:agent', 'investment:agent-mobile'],
            },
          },
        ],
      },
    })) > 0;

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

  const normalizedMenus = normalizeRouteMenus(processedMenus, {
    hasSuperRole,
  });

  return useResponseSuccess(
    await appendMembershipRouteMenus(
      appendBillRouteMenus(normalizedMenus),
      userinfo,
      {
        hasInvestmentRegistrationAccess,
        hasSuperRole,
      },
    ),
  );
});

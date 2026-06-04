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

const CRM_ROUTE_MENUS = [
  {
    authCode: 'crm:acquisition',
    component: '/crm/acquisition/index',
    meta: {
      icon: 'mdi:qrcode-scan',
      order: 60,
      title: '获客推广',
    },
    name: 'CrmAcquisition',
    path: '/crm/acquisition',
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

function appendCrmRouteMenus(menus: any[]) {
  return appendRouteMenus(menus, CRM_ROUTE_MENUS);
}

function appendBillRouteMenus(menus: any[]) {
  return appendRouteMenus(menus, BILL_ROUTE_MENUS);
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

async function appendMembershipRouteMenus(
  menus: any[],
  userinfo: any,
  options: { hasSuperRole: boolean },
) {
  const investmentScope = options.hasSuperRole ? 'full' : 'publicCrawlOnly';
  const scopedMenus = options.hasSuperRole
    ? menus
    : filterInvestmentPublicCrawlMenus(menus);
  const baseMenus = appendProfileAuxiliaryRouteMenus(scopedMenus, {
    investmentScope,
  });
  if (!(await isMembershipRestrictedUser(userinfo))) {
    return baseMenus;
  }

  return appendRouteMenus(baseMenus, MEMBERSHIP_RESTRICTED_ROUTE_MENUS);
}

function normalizeRouteMenus(menus: any[], options: { hasSuperRole: boolean }) {
  return normalizeParkManagementMenuPlacement(menus, {
    ensureParkWhenMissing: options.hasSuperRole,
    includeCompatibilityRoutes: true,
    includeMobileRoute: true,
    preferLegacyMenu: false,
  });
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

    const normalizedMenus = normalizeRouteMenus(processedMenus, {
      hasSuperRole,
    });

    return useResponseSuccess(
      await appendMembershipRouteMenus(
        appendBillRouteMenus(appendCrmRouteMenus(normalizedMenus)),
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
        hasSuperRole,
      },
    ),
  );
});

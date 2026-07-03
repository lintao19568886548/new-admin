import type {
  RouteLocationNormalized,
  RouteLocationRaw,
  Router,
} from 'vue-router';

import { DEFAULT_HOME_PATH, LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import { coreRouteNames } from '#/router/routes';
import { useAuthStore } from '#/store';
import {
  buildMembershipAccessRedirect,
  isMembershipAllowedRoutePath,
  resolveMembershipAccessState,
} from '#/utils/membership-access';
import { syncMembershipAccessWatch } from '#/utils/membership-access-watch';

import { resolveUserHomePath } from './home-path';

const CRM_INVITE_PATH = '/invite/crm';
const CRM_INVITE_LEGACY_PATH = '/crm/invite';
const MOBILE_PUBLIC_SHELL_PATHS = new Set(['/home', '/profile', '/workbench']);

interface MobileRouteTarget {
  paramName?: string;
  path?: string;
  preserveParams?: boolean;
  targetNames?: string[];
}

// Only list routes whose mobile experience lives on a separate route.
// Routes with responsive App adaptation in the same component must stay out.
const MOBILE_ROUTE_TARGETS_BY_NAME = {
  AccessBrand: {
    path: '/access/brand/mobile',
    targetNames: ['AccessBrandMobile'],
  },
  Bill: { path: '/bill/mobile-list', targetNames: ['BillMobileList'] },
  CarAccess: {
    path: '/access/car/mobile',
    targetNames: ['CarAccessMobile'],
  },
  ElectricMeterBrand: {
    path: '/smart-meter/electric-brand/mobile',
    targetNames: ['ElectricMeterBrandMobile'],
  },
  Elevator: {
    path: '/maintenance/elevator/mobile',
    targetNames: ['ElevatorMobile'],
  },
  FactoryMaint: {
    path: '/maintenance/factoryMaint/mobile',
    targetNames: ['FactoryMaintMobile'],
  },
  FinanceManage: {
    path: '/finance/mobile-manage',
    targetNames: ['FinanceMobileManage'],
  },
  Firefighting: {
    path: '/maintenance/firefighting/mobile',
    targetNames: ['FirefightingMobile'],
  },
  HrmInformation: {
    path: '/hrm/mobile-information',
    targetNames: ['HrmMobileInformation', 'HrmInformationMobile'],
  },
  HrmLeaveApplication: {
    path: '/hrm/leavemobile',
    targetNames: ['HrmLeaveApplicationMobile'],
  },
  HygieneCheck: {
    path: '/maintenance/hygieneCheck/mobile',
    targetNames: ['HygieneCheckMobile'],
  },
  Investment: {
    path: '/investment/app',
    targetNames: ['InvestmentApp'],
  },
  InvestmentAgent: {
    path: '/investment/mobile',
    targetNames: ['InvestmentAgentMobileList'],
  },
  InvestmentPublicCrawl: {
    path: '/investment/radar/mobile-public-demands',
    targetNames: ['InvestmentRadarMobilePublicDemands'],
  },
  InvestmentRadar: {
    path: '/investment/radar/mobile',
    targetNames: ['InvestmentRadarMobileList'],
  },
  InvestmentRadarCrawlerSources: {
    path: '/investment/radar/mobile-crawler-sources',
    targetNames: ['InvestmentRadarMobileCrawlerSources'],
  },
  InvestmentRadarCrawlerTasks: {
    path: '/investment/radar/mobile-crawler-tasks',
    targetNames: ['InvestmentRadarMobileCrawlerTasks'],
  },
  InvestmentRadarEnterpriseProfiles: {
    path: '/investment/radar/mobile-enterprise-profiles',
    targetNames: ['InvestmentRadarMobileEnterpriseProfiles'],
  },
  InvestmentRadarExternalLeads: {
    path: '/investment/radar/mobile-external-leads',
    targetNames: ['InvestmentRadarMobileExternalLeads'],
  },
  InvestmentRadarFactoryListings: {
    path: '/investment/radar/mobile-factory-listings',
    targetNames: ['InvestmentRadarMobileFactoryListings'],
  },
  InvestmentRadarPublicDemands: {
    path: '/investment/radar/mobile-public-demands',
    targetNames: ['InvestmentRadarMobilePublicDemands'],
  },
  InvestmentRadarScoreRules: {
    path: '/investment/radar/mobile-score-rules',
    targetNames: ['InvestmentRadarMobileScoreRules'],
  },
  InvestmentRadarSignalEvents: {
    path: '/investment/radar/mobile-signal-events',
    targetNames: ['InvestmentRadarMobileSignalEvents'],
  },
  MeterList: {
    path: '/smart-meter/reading/mobile',
    targetNames: ['SmartMeterReadingMobile'],
  },
  Notices: { path: '/notices/mobile', targetNames: ['NoticesMobile'] },
  ReimbursementApplication: {
    path: '/reimbursement/mobile-apply',
    targetNames: ['ReimbursementMobileApply'],
  },
  ReimbursementAudit: {
    path: '/reimbursement/mobile-audit',
    targetNames: ['ReimbursementMobileAudit'],
  },
  RentalManage: {
    path: '/rental/manage/mobile',
    targetNames: ['RentalManageMobile', 'SystemParkMobile'],
  },
  RepairOrder: {
    path: '/maintenance/repair-order/mobile',
    targetNames: ['RepairOrderMobile'],
  },
  SettledFactory: {
    path: '/rental/settled/mobile',
    targetNames: ['SettledFactoryMobile'],
  },
  SmartMeterElectricReading: {
    path: '/smart-meter/reading/mobile',
    targetNames: ['SmartMeterReadingMobile'],
  },
  SmartMeterWaterReading: {
    path: '/smart-meter/reading/mobile',
    targetNames: ['SmartMeterReadingMobile'],
  },
  SystemPark: {
    path: '/system/park/mobile',
    targetNames: ['SystemParkMobile', 'RentalManageMobile'],
  },
  TenantManage: {
    path: '/rental/tenant/mobile',
    targetNames: ['TenantMobileList'],
  },
  Transformer: {
    path: '/maintenance/transformer/mobile',
    targetNames: ['TransformerMobile'],
  },
  VisitorAccess: {
    path: '/access/visitor/mobile',
    targetNames: ['VisitorMobileList'],
  },
  WaterList: {
    path: '/smart-meter/reading/mobile',
    targetNames: ['SmartMeterReadingMobile'],
  },
  WaterMeterBrand: {
    path: '/smart-meter/water-brand/mobile',
    targetNames: ['WaterMeterBrandMobile'],
  },
  Workspace: { path: '/workbench', targetNames: ['Workbench'] },
} satisfies Record<string, MobileRouteTarget>;

type MobileRouteTargetName = keyof typeof MOBILE_ROUTE_TARGETS_BY_NAME;

const MOBILE_ROUTE_TARGETS_BY_PATH: Record<string, MobileRouteTarget> = {
  '/access/brand': MOBILE_ROUTE_TARGETS_BY_NAME.AccessBrand,
  '/access/car': MOBILE_ROUTE_TARGETS_BY_NAME.CarAccess,
  '/access/visitor': MOBILE_ROUTE_TARGETS_BY_NAME.VisitorAccess,
  '/bill': MOBILE_ROUTE_TARGETS_BY_NAME.Bill,
  '/finance/manage': MOBILE_ROUTE_TARGETS_BY_NAME.FinanceManage,
  '/hrm/information': MOBILE_ROUTE_TARGETS_BY_NAME.HrmInformation,
  '/hrm/leaveapplication': MOBILE_ROUTE_TARGETS_BY_NAME.HrmLeaveApplication,
  '/investment': MOBILE_ROUTE_TARGETS_BY_NAME.Investment,
  '/investment-public-crawl':
    MOBILE_ROUTE_TARGETS_BY_NAME.InvestmentPublicCrawl,
  '/investment/agent': MOBILE_ROUTE_TARGETS_BY_NAME.InvestmentAgent,
  '/investment/radar': MOBILE_ROUTE_TARGETS_BY_NAME.InvestmentRadar,
  '/investment/radar-crawler-sources':
    MOBILE_ROUTE_TARGETS_BY_NAME.InvestmentRadarCrawlerSources,
  '/investment/radar-crawler-tasks':
    MOBILE_ROUTE_TARGETS_BY_NAME.InvestmentRadarCrawlerTasks,
  '/investment/radar-enterprise-profiles':
    MOBILE_ROUTE_TARGETS_BY_NAME.InvestmentRadarEnterpriseProfiles,
  '/investment/radar-external-leads':
    MOBILE_ROUTE_TARGETS_BY_NAME.InvestmentRadarExternalLeads,
  '/investment/radar-public-demands':
    MOBILE_ROUTE_TARGETS_BY_NAME.InvestmentRadarPublicDemands,
  '/investment/radar-score-rules':
    MOBILE_ROUTE_TARGETS_BY_NAME.InvestmentRadarScoreRules,
  '/investment/radar-signal-events':
    MOBILE_ROUTE_TARGETS_BY_NAME.InvestmentRadarSignalEvents,
  '/maintenance/elevator': MOBILE_ROUTE_TARGETS_BY_NAME.Elevator,
  '/maintenance/factoryMaint': MOBILE_ROUTE_TARGETS_BY_NAME.FactoryMaint,
  '/maintenance/firefighting': MOBILE_ROUTE_TARGETS_BY_NAME.Firefighting,
  '/maintenance/hygieneCheck': MOBILE_ROUTE_TARGETS_BY_NAME.HygieneCheck,
  '/maintenance/repair-order': MOBILE_ROUTE_TARGETS_BY_NAME.RepairOrder,
  '/maintenance/transformer': MOBILE_ROUTE_TARGETS_BY_NAME.Transformer,
  '/notices': MOBILE_ROUTE_TARGETS_BY_NAME.Notices,
  '/reimbursement/application':
    MOBILE_ROUTE_TARGETS_BY_NAME.ReimbursementApplication,
  '/reimbursement/audit': MOBILE_ROUTE_TARGETS_BY_NAME.ReimbursementAudit,
  '/rental/manage': MOBILE_ROUTE_TARGETS_BY_NAME.RentalManage,
  '/rental/meter': MOBILE_ROUTE_TARGETS_BY_NAME.MeterList,
  '/rental/settled': MOBILE_ROUTE_TARGETS_BY_NAME.SettledFactory,
  '/rental/tenant': MOBILE_ROUTE_TARGETS_BY_NAME.TenantManage,
  '/rental/water': MOBILE_ROUTE_TARGETS_BY_NAME.WaterList,
  '/smart-meter/electric-brand':
    MOBILE_ROUTE_TARGETS_BY_NAME.ElectricMeterBrand,
  '/smart-meter/meter': MOBILE_ROUTE_TARGETS_BY_NAME.SmartMeterElectricReading,
  '/smart-meter/water': MOBILE_ROUTE_TARGETS_BY_NAME.SmartMeterWaterReading,
  '/smart-meter/water-brand': MOBILE_ROUTE_TARGETS_BY_NAME.WaterMeterBrand,
  '/system/park': MOBILE_ROUTE_TARGETS_BY_NAME.SystemPark,
  '/workspace': MOBILE_ROUTE_TARGETS_BY_NAME.Workspace,
  '/investment/radar-factory-listings':
    MOBILE_ROUTE_TARGETS_BY_NAME.InvestmentRadarFactoryListings,
};

function getQueryText(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
}

function getHashQueryText(hash: string, names: string[]) {
  const rawHash = String(hash || '')
    .replace(/^#/, '')
    .trim();
  if (!rawHash) {
    return '';
  }

  const queryText = rawHash.includes('?')
    ? rawHash.slice(rawHash.indexOf('?') + 1)
    : rawHash;
  const searchParams = new URLSearchParams(queryText);

  for (const name of names) {
    const value = searchParams.get(name);
    if (value) {
      return value.trim();
    }
  }

  return '';
}

function getRouteQueryText(
  route: { hash?: string; query: Record<string, unknown> },
  ...names: string[]
) {
  for (const name of names) {
    const value = getQueryText(route.query[name]);
    if (value) {
      return value;
    }
  }
  return getHashQueryText(route.hash || '', names);
}

function resolveCrmInviteFromMiniProgramEntry(to: {
  hash?: string;
  path: string;
  query: Record<string, unknown>;
}) {
  if (isCrmInvitePublicPath(to.path)) {
    return null;
  }

  const scene = getRouteQueryText(to, 'scene', 's');
  if (!scene) {
    return null;
  }

  const isHomeEntry =
    to.path === '/' || to.path === '/home' || to.path === DEFAULT_HOME_PATH;
  if (!isHomeEntry) {
    return null;
  }

  return {
    path: CRM_INVITE_PATH,
    query: {
      openid: getRouteQueryText(to, 'openid'),
      phone: getRouteQueryText(to, 'phone'),
      scene,
      source: getRouteQueryText(to, 'source') || 'miniprogram_shell',
      unionid: getRouteQueryText(to, 'unionid'),
    },
    replace: true,
  };
}

function isCrmInvitePublicPath(path: string) {
  const normalizedPath = normalizePath(path);
  return (
    normalizedPath === CRM_INVITE_PATH ||
    normalizedPath === CRM_INVITE_LEGACY_PATH
  );
}

function isMobileViewport() {
  return window.innerWidth < 768;
}

function getMatchedRouteName(to: RouteLocationNormalized) {
  return [...to.matched]
    .reverse()
    .map((route) => route.name)
    .find((name) => typeof name === 'string') as string | undefined;
}

function normalizePath(path: string) {
  return path.replace(/\/+$/, '') || '/';
}

function isPublicShellPath(path: string) {
  return MOBILE_PUBLIC_SHELL_PATHS.has(normalizePath(path));
}

function isAuthenticatedHomePath(path: string) {
  return normalizePath(path) === '/home';
}

function isMobilePublicShellPath(path: string) {
  return (
    isMobileViewport() &&
    isPublicShellPath(path) &&
    !isAuthenticatedHomePath(path)
  );
}

function getMobileRouteTarget(to: RouteLocationNormalized) {
  const routeName =
    (typeof to.name === 'string' ? to.name : undefined) ||
    getMatchedRouteName(to);
  if (routeName && isMobileRouteTargetName(routeName)) {
    return MOBILE_ROUTE_TARGETS_BY_NAME[routeName];
  }
  return MOBILE_ROUTE_TARGETS_BY_PATH[normalizePath(to.path)];
}

function isMobileRouteTargetName(name: string): name is MobileRouteTargetName {
  return Object.hasOwn(MOBILE_ROUTE_TARGETS_BY_NAME, name);
}

function getExistingTargetRouteName(router: Router, target: MobileRouteTarget) {
  return target.targetNames?.find((name) => router.hasRoute(name));
}

function hasTargetRoute(router: Router, target: MobileRouteTarget) {
  const targetPath = target.path;
  if (
    getExistingTargetRouteName(router, target) ||
    (targetPath &&
      router
        .getRoutes()
        .some(
          (route) => normalizePath(route.path) === normalizePath(targetPath),
        ))
  ) {
    return true;
  }
  return false;
}

function getRouteParamText(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
}

function buildMobileRouteLocation(
  router: Router,
  to: RouteLocationNormalized,
  target: MobileRouteTarget,
): null | RouteLocationRaw {
  if (!target.path) {
    return null;
  }

  const targetRouteName = getExistingTargetRouteName(router, target);
  const targetPath = normalizePath(target.path);
  const currentPath = normalizePath(to.path);
  if (currentPath === targetPath || currentPath.includes('/mobile')) {
    return null;
  }

  const routeLocation: RouteLocationRaw = {
    hash: to.hash,
    path: targetPath,
    query: to.query,
    replace: true,
  };

  if (targetRouteName && !target.preserveParams) {
    return {
      hash: to.hash,
      name: targetRouteName,
      query: to.query,
      replace: true,
    };
  }

  if (target.preserveParams && Object.keys(to.params).length > 0) {
    const paramName = target.paramName || 'id';
    const paramValue = getRouteParamText(to.params[paramName]);
    if (!paramValue) {
      return routeLocation;
    }
    if (targetRouteName) {
      return {
        hash: to.hash,
        name: targetRouteName,
        params: {
          [paramName]: paramValue,
        },
        query: to.query,
        replace: true,
      };
    }
    const resolvedPath = `${targetPath}/${encodeURIComponent(paramValue)}`;
    return {
      hash: to.hash,
      path: resolvedPath,
      query: to.query,
      replace: true,
    };
  }
  return routeLocation;
}

function resolveMobileRouteRedirect(
  router: Router,
  to: RouteLocationNormalized,
) {
  if (!isMobileViewport()) {
    return null;
  }

  const target = getMobileRouteTarget(to);
  if (!target || !hasTargetRoute(router, target)) {
    return null;
  }

  return buildMobileRouteLocation(router, to, target);
}

/**
 * 通用守卫配置
 * @param router
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();

  router.beforeEach(async (to) => {
    const crmInviteRedirect = resolveCrmInviteFromMiniProgramEntry(to);
    if (crmInviteRedirect) {
      return crmInviteRedirect;
    }

    const mobileRouteRedirect = resolveMobileRouteRedirect(router, to);
    if (mobileRouteRedirect) {
      return mobileRouteRedirect;
    }

    to.meta.loaded = loadedPaths.has(to.path);

    // 页面加载进度条
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to) => {
    // 记录页面是否加载,如果已经加载，后续的页面切换动画等效果不在重复执行
    loadedPaths.add(to.path);

    // 关闭页面加载进度条
    if (preferences.transition.progress) {
      stopProgress();
    }
  });
}

/**
 * 权限访问守卫配置
 * @param router
 */
function setupAccessGuard(router: Router) {
  // 需要短信验证的页面路由
  const smsVerificationRequiredRoutes = new Set([
    'Bill',
    'BillMobileList',
    'FinanceManage',
    'FinanceMobileManage',
  ]);

  router.beforeEach(async (to, from) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();
    if (isCrmInvitePublicPath(to.path)) {
      return true;
    }
    // 基本路由，这些路由不需要进入权限拦截
    if (coreRouteNames.includes(to.name as string)) {
      if (isAuthenticatedHomePath(to.path) && !accessStore.accessToken) {
        return true;
      }

      if (
        isPublicShellPath(to.path) &&
        !isMobileViewport() &&
        !accessStore.accessToken
      ) {
        return {
          path: LOGIN_PATH,
          query: { redirect: encodeURIComponent(to.fullPath) },
          replace: true,
        };
      }

      if (to.path === LOGIN_PATH && accessStore.accessToken) {
        return decodeURIComponent(
          (to.query?.redirect as string) ||
            resolveUserHomePath(userStore.userInfo?.homePath),
        );
      }
      if (
        isPublicShellPath(to.path) &&
        accessStore.accessToken &&
        (!accessStore.isAccessChecked || accessStore.accessMenus.length === 0)
      ) {
        await authStore.ensureSessionReady({ forceRebuildAccess: true });
      }
      return true;
    }

    // accessToken 检查
    if (!accessStore.accessToken) {
      if (isMobilePublicShellPath(to.path)) {
        return true;
      }

      // 明确声明忽略权限访问权限，则可以访问
      if (to.meta.ignoreAccess) {
        return true;
      }

      // 没有访问权限，跳转登录页面
      if (to.fullPath !== LOGIN_PATH) {
        return {
          path: LOGIN_PATH,
          // 如不需要，直接删除 query
          query:
            to.fullPath === DEFAULT_HOME_PATH
              ? {}
              : { redirect: encodeURIComponent(to.fullPath) },
          // 携带当前跳转的页面，登录后重新跳转该页面
          replace: true,
        };
      }
      return to;
    }

    // 检查是否需要短信验证码验证
    if (smsVerificationRequiredRoutes.has(to.name as string)) {
      // 如果未验证，允许进入页面，但页面会显示验证模态框
      // 这里不做拦截，由页面组件自行处理验证逻辑
    }

    // 是否已经生成过动态路由
    if (accessStore.isAccessChecked && accessStore.accessMenus.length === 0) {
      await authStore.ensureSessionReady({ forceRebuildAccess: true });
    }

    if (accessStore.isAccessChecked) {
      const mobileRouteRedirect = resolveMobileRouteRedirect(router, to);
      if (mobileRouteRedirect) {
        return mobileRouteRedirect;
      }
      return true;
    }

    const userInfo =
      userStore.userInfo || (await authStore.ensureSessionReady());
    if (!userInfo) {
      return {
        path: LOGIN_PATH,
        query:
          to.fullPath === DEFAULT_HOME_PATH
            ? {}
            : { redirect: encodeURIComponent(to.fullPath) },
        replace: true,
      };
    }
    const mobileRouteRedirect = resolveMobileRouteRedirect(router, to);
    if (mobileRouteRedirect) {
      return mobileRouteRedirect;
    }

    const redirectPath = (from.query.redirect ??
      (to.path === DEFAULT_HOME_PATH
        ? resolveUserHomePath(userInfo.homePath)
        : to.fullPath)) as string;
    const resolvedRedirectPath = router.resolve(
      decodeURIComponent(redirectPath),
    );

    if (
      resolvedRedirectPath.fullPath === to.fullPath &&
      resolvedRedirectPath.name === to.name
    ) {
      return true;
    }

    return {
      ...resolvedRedirectPath,
      replace: true,
    };
  });
}

function setupMembershipAccessGuard(router: Router) {
  router.beforeEach(async (to) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();

    if (isCrmInvitePublicPath(to.path)) {
      return true;
    }

    if (!accessStore.accessToken) {
      return true;
    }

    if (coreRouteNames.includes(to.name as string)) {
      return true;
    }

    const userInfo =
      userStore.userInfo || (await authStore.ensureSessionReady());
    if (!userInfo) {
      return true;
    }
    syncMembershipAccessWatch(userInfo, authStore.fetchUserInfo);
    const membershipAccessState = resolveMembershipAccessState(userInfo);

    if (!membershipAccessState.accessRestricted) {
      return true;
    }

    if (isMembershipAllowedRoutePath(to.path)) {
      return true;
    }

    return buildMembershipAccessRedirect(
      to.fullPath,
      membershipAccessState.membershipGateReason,
    );
  });
}

/**
 * 项目守卫配置
 * @param router
 */
function createRouterGuard(router: Router) {
  /** 通用 */
  setupCommonGuard(router);
  /** 权限访问 */
  setupAccessGuard(router);
  /** 会员访问 */
  setupMembershipAccessGuard(router);
}

export { createRouterGuard };

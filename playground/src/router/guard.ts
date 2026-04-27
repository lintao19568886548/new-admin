import type { Router } from 'vue-router';

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

/**
 * 通用守卫配置
 * @param router
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();

  router.beforeEach(async (to) => {
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
    // 基本路由，这些路由不需要进入权限拦截
    if (coreRouteNames.includes(to.name as string)) {
      if (to.path === LOGIN_PATH && accessStore.accessToken) {
        return decodeURIComponent(
          (to.query?.redirect as string) ||
            resolveUserHomePath(userStore.userInfo?.homePath),
        );
      }
      return true;
    }

    // accessToken 检查
    if (!accessStore.accessToken) {
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
    if (accessStore.isAccessChecked) {
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
    const redirectPath = (from.query.redirect ??
      (to.path === DEFAULT_HOME_PATH
        ? resolveUserHomePath(userInfo.homePath)
        : to.fullPath)) as string;

    return {
      ...router.resolve(decodeURIComponent(redirectPath)),
      replace: true,
    };
  });
}

function setupMembershipAccessGuard(router: Router) {
  router.beforeEach(async (to) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();

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

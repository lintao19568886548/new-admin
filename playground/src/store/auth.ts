import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { DEFAULT_HOME_PATH, LOGIN_PATH } from '@vben/constants';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';
import { resetStaticRoutes } from '@vben/utils';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import {
  getAccessCodesApi,
  getUserInfoApi,
  loginApi,
  loginBySmsCodeApi,
  logoutApi,
} from '#/api';
import { $t } from '#/locales';
import { resolveUserHomePath } from '#/router/home-path';
import { accessRoutes, routes } from '#/router/routes';
import { useMenuStore } from '#/store/menu';
import {
  clearMembershipAccessWatch,
  syncMembershipAccessWatch,
} from '#/utils/membership-access-watch';

type ReauthReason = 'token_expired' | 'unknown';
type SessionStatus =
  | 'anonymous'
  | 'authenticating'
  | 'hydrating'
  | 'logging_out'
  | 'ready'
  | 'reauth_required';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const menuStore = useMenuStore();
  const userStore = useUserStore();
  const router = useRouter();

  const authSessionVersion = ref(0);
  const loginLoading = ref(false);
  const sessionReauthReason = ref<null | ReauthReason>(null);
  const sessionResumePath = ref<null | string>(null);
  const sessionStatus = ref<SessionStatus>('anonymous');

  function resolveSessionResumePath() {
    const currentPath = router.currentRoute.value.fullPath;
    if (!currentPath || currentPath === DEFAULT_HOME_PATH) {
      return DEFAULT_HOME_PATH;
    }
    if (currentPath === LOGIN_PATH || currentPath.startsWith('/auth/')) {
      return null;
    }
    return currentPath;
  }

  function clearSessionSnapshot(
    options: { keepAccessSnapshot?: boolean; keepLoginExpired?: boolean } = {},
  ) {
    clearMembershipAccessWatch();
    if (!options.keepAccessSnapshot) {
      accessStore.setAccessCodes([]);
      accessStore.setAccessMenus([]);
      accessStore.setAccessRoutes([]);
      accessStore.setIsAccessChecked(false);
      resetStaticRoutes(router, routes);
    }
    if (!options.keepLoginExpired) {
      accessStore.setLoginExpired(false);
    }
    userStore.setUserInfo(null);
    menuStore.$reset();
  }

  function resetSessionState(
    options: {
      clearResumeContext?: boolean;
      keepAccessSnapshot?: boolean;
      keepLoginExpired?: boolean;
      nextStatus?: SessionStatus;
    } = {},
  ) {
    authSessionVersion.value += 1;
    if (options.clearResumeContext !== false) {
      sessionReauthReason.value = null;
      sessionResumePath.value = null;
    }
    if (options.nextStatus) {
      sessionStatus.value = options.nextStatus;
    }
    clearSessionSnapshot({
      keepAccessSnapshot: options.keepAccessSnapshot,
      keepLoginExpired: options.keepLoginExpired,
    });
  }

  function requireReauthentication(reason: ReauthReason = 'token_expired') {
    if (sessionStatus.value === 'logging_out') {
      return;
    }
    if (sessionStatus.value === 'reauth_required' && accessStore.loginExpired) {
      return;
    }
    sessionReauthReason.value = reason;
    sessionResumePath.value = resolveSessionResumePath();
    accessStore.setAccessToken(null);
    resetSessionState({
      clearResumeContext: false,
      keepAccessSnapshot: true,
      keepLoginExpired: true,
      nextStatus: 'reauth_required',
    });
    accessStore.setLoginExpired(true);
  }

  function isCurrentSession(version: number, accessToken: string) {
    return (
      authSessionVersion.value === version &&
      accessStore.accessToken === accessToken
    );
  }

  async function rebuildAccessSnapshot(params: {
    accessToken: string;
    sessionVersion: number;
    userInfo: UserInfo;
  }) {
    const { generateAccess } = await import('#/router/access');
    const userRoles = params.userInfo.roles ?? [];
    const { accessibleMenus, accessibleRoutes } = await generateAccess({
      roles: userRoles,
      router,
      routes: accessRoutes,
    });

    if (!isCurrentSession(params.sessionVersion, params.accessToken)) {
      resetStaticRoutes(router, routes);
      return null;
    }

    return {
      accessibleMenus,
      accessibleRoutes,
    };
  }

  async function ensureSessionReady(
    options: {
      forceRebuildAccess?: boolean;
      forceRefreshUserInfo?: boolean;
    } = {},
  ): Promise<null | UserInfo> {
    if (!accessStore.accessToken) {
      sessionStatus.value = 'anonymous';
      return null;
    }

    const currentAccessToken = accessStore.accessToken;
    const currentSessionVersion = authSessionVersion.value;
    if (sessionStatus.value === 'anonymous') {
      sessionStatus.value = 'hydrating';
    }

    const shouldRefreshUserInfo =
      options.forceRefreshUserInfo || !userStore.userInfo;
    const userInfo = shouldRefreshUserInfo
      ? await fetchUserInfo()
      : (userStore.userInfo as null | UserInfo);
    if (!userInfo) {
      return null;
    }

    const shouldRebuildAccess =
      options.forceRebuildAccess ||
      !accessStore.isAccessChecked ||
      accessStore.accessMenus.length === 0;

    const [accessCodes, accessSnapshot] = await Promise.all([
      getAccessCodesApi(),
      shouldRebuildAccess
        ? rebuildAccessSnapshot({
            accessToken: currentAccessToken,
            sessionVersion: currentSessionVersion,
            userInfo,
          })
        : Promise.resolve(null),
    ]);

    if (!isCurrentSession(currentSessionVersion, currentAccessToken)) {
      return null;
    }

    accessStore.setAccessCodes(accessCodes);
    if (accessSnapshot) {
      accessStore.setAccessMenus(accessSnapshot.accessibleMenus);
      accessStore.setAccessRoutes(accessSnapshot.accessibleRoutes);
      accessStore.setIsAccessChecked(true);
    }
    sessionStatus.value = 'ready';
    return userInfo;
  }

  async function handleAfterLogin(
    accessToken: string,
    options: {
      onSuccess?: () => Promise<void> | void;
      resumeAfterHydration?: boolean;
    } = {},
  ): Promise<UserInfo> {
    const resumeAfterHydration = options.resumeAfterHydration === true;
    const resumePath = resumeAfterHydration ? sessionResumePath.value : null;

    resetSessionState({
      clearResumeContext: !resumeAfterHydration,
      keepLoginExpired: resumeAfterHydration,
      nextStatus: 'hydrating',
    });
    accessStore.setAccessToken(accessToken);

    const userInfo = await ensureSessionReady({
      forceRebuildAccess: true,
      forceRefreshUserInfo: true,
    });
    if (!userInfo) {
      if (accessStore.accessToken === accessToken) {
        accessStore.setAccessToken(null);
      }
      sessionStatus.value = resumeAfterHydration
        ? 'reauth_required'
        : 'anonymous';
      throw new Error('登录状态已变更，请重新登录');
    }

    sessionStatus.value = 'ready';
    accessStore.setLoginExpired(false);
    sessionReauthReason.value = null;
    sessionResumePath.value = null;

    if (options.onSuccess) {
      await options.onSuccess();
    } else if (
      resumePath &&
      resumePath !== router.currentRoute.value.fullPath
    ) {
      await router.replace(resumePath);
    } else if (!resumePath) {
      const afterLoginPath = resolveUserHomePath(userInfo.homePath);
      await router.push(afterLoginPath);
    }

    if (userInfo.realName) {
      notification.success({
        description: `${$t('authentication.loginSuccessDesc')}:${userInfo.realName}`,
        duration: 3,
        message: $t('authentication.loginSuccess'),
      });
    }

    return userInfo;
  }

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   * @param onSuccess 成功之后的回调函�?   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    let userInfo: null | UserInfo = null;
    const resumeAfterHydration =
      sessionStatus.value === 'reauth_required' ||
      accessStore.loginExpired ||
      Boolean(sessionResumePath.value);
    try {
      sessionStatus.value = 'authenticating';
      loginLoading.value = true;
      const { accessToken } = await loginApi(params);

      if (accessToken) {
        userInfo = await handleAfterLogin(accessToken, {
          onSuccess,
          resumeAfterHydration,
        });
      }
    } catch (error) {
      sessionStatus.value = resumeAfterHydration
        ? 'reauth_required'
        : 'anonymous';
      throw error;
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  /**
   * 短信验证码登录
   */
  async function authLoginBySmsCode(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    let userInfo: null | UserInfo = null;
    const resumeAfterHydration =
      sessionStatus.value === 'reauth_required' ||
      accessStore.loginExpired ||
      Boolean(sessionResumePath.value);
    try {
      sessionStatus.value = 'authenticating';
      loginLoading.value = true;
      const { accessToken } = await loginBySmsCodeApi(
        params as { code: string; phoneNumber: string },
      );

      if (accessToken) {
        userInfo = await handleAfterLogin(accessToken, {
          onSuccess,
          resumeAfterHydration,
        });
      }
    } catch (error) {
      sessionStatus.value = resumeAfterHydration
        ? 'reauth_required'
        : 'anonymous';
      throw error;
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true, callLogoutApi = true) {
    sessionStatus.value = 'logging_out';
    accessStore.setAccessToken(null);
    resetSessionState({
      clearResumeContext: true,
      nextStatus: 'logging_out',
    });
    if (callLogoutApi) {
      try {
        await logoutApi();
      } catch {
        // 不做任何处理
      }
    }

    resetAllStores();
    accessStore.setLoginExpired(false);
    sessionStatus.value = 'anonymous';

    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  async function fetchUserInfo(): Promise<null | UserInfo> {
    if (!accessStore.accessToken) {
      sessionStatus.value = 'anonymous';
      return null;
    }

    const currentSessionVersion = authSessionVersion.value;
    const userInfo = await getUserInfoApi();
    if (
      currentSessionVersion !== authSessionVersion.value ||
      !accessStore.accessToken
    ) {
      return null;
    }
    userStore.setUserInfo(userInfo);
    syncMembershipAccessWatch(userInfo, fetchUserInfo);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
    sessionReauthReason.value = null;
    sessionResumePath.value = null;
    sessionStatus.value = 'anonymous';
  }

  return {
    $reset,
    authLogin,
    authLoginBySmsCode,
    ensureSessionReady,
    fetchUserInfo,
    loginLoading,
    logout,
    requireReauthentication,
    sessionReauthReason,
    sessionResumePath,
    sessionStatus,
  };
});

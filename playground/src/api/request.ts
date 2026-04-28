/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@vben/request';

import type { MembershipGateReason } from '#/utils/membership-access';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { router } from '#/router';
import { useAuthStore } from '#/store';
import {
  buildMembershipAccessRedirect,
  MEMBERSHIP_PAGE_PATH,
} from '#/utils/membership-access';

import { refreshTokenApi } from './core';
import { createRetryResponseBridge } from './request-retry-bridge';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

const FORCE_LOGOUT_AUTH_ERROR_CODES = new Set([
  'AUTH_CUSTOMER_SCOPE_CHANGED',
  'AUTH_REFRESH_TOKEN_INVALID',
  'AUTH_REFRESH_TOKEN_MISSING',
  'AUTH_REFRESH_TOKEN_REVOKED',
  'AUTH_TOKEN_VERSION_MISMATCH',
]);

function resolveResponseData(error: unknown) {
  if (!error || typeof error !== 'object') {
    return {};
  }

  return ((error as any).response?.data ?? {}) as Record<string, unknown>;
}

function shouldForceLogoutForAuthError(error: unknown) {
  const responseData = resolveResponseData(error);
  return FORCE_LOGOUT_AUTH_ERROR_CODES.has(
    String(responseData.errorCode || ''),
  );
}

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });
  const retryResponseBridge = createRetryResponseBridge();
  let forceLogoutOnNextReauth = false;
  let forceLogoutRunning = false;
  let lastMembershipRedirectAt = 0;

  const errorMessageLastShownAt = new Map<string, number>();
  const showErrorMessageDedup = (
    content: string,
    key: string,
    cooldownMs: number,
  ) => {
    const now = Date.now();
    const last = errorMessageLastShownAt.get(key) ?? 0;
    if (now - last < cooldownMs) return;
    errorMessageLastShownAt.set(key, now);
    message.error({ content, key });
  };
  const redirectToMembershipPage = (reason: unknown) => {
    const normalizedReason: MembershipGateReason =
      reason === 'membership_expired' ? 'membership_expired' : 'trial_expired';
    const now = Date.now();
    if (now - lastMembershipRedirectAt < 1000) {
      return;
    }
    lastMembershipRedirectAt = now;

    const currentRoute = router.currentRoute.value;
    if (currentRoute.path === MEMBERSHIP_PAGE_PATH) {
      return;
    }

    void router.replace(
      buildMembershipAccessRedirect(currentRoute.fullPath, normalizedReason),
    );
  };

  const markAuthRefreshError = (error: unknown) =>
    error && typeof error === 'object'
      ? Object.assign(error as any, { __fromAuthRefresh: true })
      : { __fromAuthRefresh: true, message: String(error) };

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate(error?: unknown) {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    const shouldForceLogout =
      forceLogoutOnNextReauth || shouldForceLogoutForAuthError(error);
    forceLogoutOnNextReauth = false;
    if (shouldForceLogout) {
      if (forceLogoutRunning) {
        return;
      }
      forceLogoutRunning = true;
      try {
        await authStore.logout(false, false);
      } finally {
        forceLogoutRunning = false;
      }
      return;
    }

    const canShowExpiredModal =
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked;
    if (canShowExpiredModal) {
      authStore.requireReauthentication('token_expired');
    } else {
      await authStore.logout(true, !client.isRefreshing);
    }
  }

  /**
   * 刷新token逻辑
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    try {
      const resp = await refreshTokenApi();
      const newToken = resp.data;
      accessStore.setAccessToken(newToken);
      return newToken;
    } catch (error) {
      if (shouldForceLogoutForAuthError(error)) {
        forceLogoutOnNextReauth = true;
      }
      throw markAuthRefreshError(error);
    }
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      retryResponseBridge.attachRequestId(config);
      return config;
    },
  });

  // 记录 refresh 重试成功响应，供后续链路返回值漂移时兜底
  client.addResponseInterceptor({
    fulfilled: (response) => retryResponseBridge.captureRetryResponse(response),
  });

  // 处理返回的响应数据格式
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode: 0,
    }),
  );

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 某些场景下 refresh 重试后 fulfilled 值会漂移为 AxiosRequestConfig，这里统一还原成业务 payload
  client.addResponseInterceptor({
    fulfilled: (payload: any): any =>
      retryResponseBridge.restoreRetryPayload(payload),
  });

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
      // 当前mock接口返回的错误字段是 error 或者 message
      const responseData = resolveResponseData(error);
      if (responseData?.errorCode === 'MEMBERSHIP_REQUIRED') {
        redirectToMembershipPage(responseData?.restrictionReason);
        return;
      }
      const errorMessage = responseData?.error ?? responseData?.message ?? '';

      if ((error as any)?.__fromAuthRefresh && !error?.response) {
        const code = (error as any)?.status ?? (error as any)?.code;
        if (code === 401) {
          const directMessage =
            (error as any)?.message ?? (error as any)?.error;
          showErrorMessageDedup(
            directMessage || '登录过期，请重新登录',
            '__auth_refresh_401__',
            3000,
          );
          return;
        }
      }

      // 如果没有错误信息，则会根据状态码进行提示
      const finalMessage = String(errorMessage || msg);
      showErrorMessageDedup(
        finalMessage,
        `__http_error__${String(finalMessage)}`,
        1200,
      );
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({ baseURL: apiURL });

export interface PageFetchParams {
  [key: string]: any;
  pageNo?: number;
  pageSize?: number;
}

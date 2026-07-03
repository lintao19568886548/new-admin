import type { RouteRecordRaw } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';

import { AuthPageLayout, BasicLayout } from '#/layouts';
import { $t } from '#/locales';
import { withRetryImport } from '#/utils/retry-import';

import { resolveDefaultHomePath } from '../home-path';

/** 全局404页面 */
const fallbackNotFoundRoute: RouteRecordRaw = {
  component: withRetryImport(
    () => import('#/views/_core/fallback/not-found.vue'),
  ),
  meta: {
    hideInBreadcrumb: true,
    hideInMenu: true,
    hideInTab: true,
    title: '404',
  },
  name: 'FallbackNotFound',
  path: '/:path(.*)*',
};

/** 基本路由，这些路由是必须存在的 */
const coreRoutes: RouteRecordRaw[] = [
  /**
   * 根路由
   * 使用基础布局，作为所有页面的父级容器，子级就不必配置BasicLayout。
   * 此路由必须存在，且不应修改
   */
  {
    component: BasicLayout,
    meta: {
      hideInBreadcrumb: true,
      title: 'Root',
    },
    name: 'Root',
    path: '/',
    redirect: () => resolveDefaultHomePath(),
    children: [
      {
        name: 'Home',
        path: '/home',
        component: withRetryImport(() => import('#/views/dashboard/index.vue')),
        meta: {
          icon: 'lucide:home',
          ignoreAccess: true,
          isApp: true,
          order: 1,
          title: '首页',
        },
      },
      {
        name: 'Workbench',
        path: '/workbench',
        component: withRetryImport(
          () => import('#/views/dashboard/workbench/index.vue'),
        ),
        meta: {
          hideMenu: true,
          icon: 'carbon:workspace',
          ignoreAccess: true,
          title: '智能管理',
        },
      },
      {
        name: 'Profile',
        path: '/profile',
        component: withRetryImport(() => import('#/views/profile/index.vue')),
        meta: {
          ignoreAccess: true,
          title: '我的',
        },
      },
    ],
  },
  {
    component: AuthPageLayout,
    meta: {
      hideInTab: true,
      title: 'Authentication',
    },
    name: 'Authentication',
    path: '/auth',
    redirect: LOGIN_PATH,
    children: [
      {
        name: 'Login',
        path: 'login',
        component: withRetryImport(
          () => import('#/views/_core/authentication/login.vue'),
        ),
        meta: {
          title: $t('page.auth.login'),
        },
      },
      {
        name: 'CodeLogin',
        path: 'code-login',
        component: withRetryImport(
          () => import('#/views/_core/authentication/code-login.vue'),
        ),
        meta: {
          title: $t('page.auth.codeLogin'),
        },
      },
      {
        name: 'QrCodeLogin',
        path: 'qrcode-login',
        component: withRetryImport(
          () => import('#/views/_core/authentication/qrcode-login.vue'),
        ),
        meta: {
          title: $t('page.auth.qrcodeLogin'),
        },
      },
      {
        name: 'ForgetPassword',
        path: 'forget-password',
        component: withRetryImport(
          () => import('#/views/_core/authentication/forget-password.vue'),
        ),
        meta: {
          title: $t('page.auth.forgetPassword'),
        },
      },
      {
        name: 'Register',
        path: 'register',
        component: withRetryImport(
          () => import('#/views/_core/authentication/register.vue'),
        ),
        meta: {
          title: $t('page.auth.register'),
        },
      },
    ],
  },
];

export { coreRoutes, fallbackNotFoundRoute };

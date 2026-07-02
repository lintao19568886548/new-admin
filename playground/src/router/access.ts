import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
  RouteRecordRaw,
  RouteRecordStringComponent,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { message } from 'ant-design-vue';

import { getAllMenusApi } from '#/api';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';
import { useMenuStore } from '#/store/menu';
import { withRetryImport } from '#/utils/retry-import';

const forbiddenComponent = withRetryImport(
  () => import('#/views/_core/fallback/forbidden.vue'),
);
const I18N_KEY_PATTERN = /^[a-z][\w-]*(?:\.[\w-]+)+$/i;
const MENU_LOAD_MAX_ATTEMPTS = 3;
const MENU_LOAD_RETRY_DELAY = 300;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function withRetryPageMap(pageMap: ComponentRecordType) {
  return Object.fromEntries(
    Object.entries(pageMap).map(([key, loader]) => [
      key,
      withRetryImport(loader),
    ]),
  ) as ComponentRecordType;
}

function translateText(value: unknown) {
  if (typeof value !== 'string' || !I18N_KEY_PATTERN.test(value)) {
    return value;
  }

  const text = $t(value);
  return text && text !== value ? text : value;
}

function translateRouteTitles<
  T extends RouteRecordRaw | RouteRecordStringComponent,
>(routes: T[]): T[] {
  return routes.map((route) => {
    const children = route.children
      ? translateRouteTitles(route.children as T[])
      : undefined;
    const title = translateText(route.meta?.title);

    return {
      ...route,
      ...(children ? { children } : {}),
      meta: route.meta
        ? {
            ...route.meta,
            title:
              typeof title === 'string'
                ? title
                : String(route.meta.title || ''),
          }
        : route.meta,
    };
  });
}

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const pageMap: ComponentRecordType = withRetryPageMap(
    import.meta.glob(['../views/**/*.vue', '!../views/**/modules/**/*.vue']),
  );

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= MENU_LOAD_MAX_ATTEMPTS; attempt += 1) {
    try {
      const accessSnapshot = await generateAccessible(
        preferences.app.accessMode,
        {
          ...options,
          fetchMenuListAsync: async () => {
            const currentPath = window.location.pathname;
            const isPrintPage = currentPath.includes('/bill/print/');

            if (!isPrintPage && attempt === 1) {
              message.loading({
                content: `${$t('common.loadingMenu')}...`,
                duration: 0.5,
              });
            }

            const menuStore = useMenuStore();
            const menus = translateRouteTitles(await getAllMenusApi());
            menuStore.setMenus(menus);
            return menus;
          },
          forbiddenComponent,
          layoutMap,
          pageMap,
        },
      );

      if (
        preferences.app.accessMode !== 'backend' ||
        accessSnapshot.accessibleMenus.length > 0 ||
        accessSnapshot.accessibleRoutes.length > 0
      ) {
        return accessSnapshot;
      }

      lastError = new Error('Backend menu access snapshot is empty.');
    } catch (error) {
      lastError = error;
    }

    if (attempt < MENU_LOAD_MAX_ATTEMPTS) {
      await delay(MENU_LOAD_RETRY_DELAY * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to generate backend menu access snapshot.');
}

export { generateAccess };

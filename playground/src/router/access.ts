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

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');
const I18N_KEY_PATTERN = /^[a-z][\w-]*(?:\.[\w-]+)+$/i;

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
  const pageMap: ComponentRecordType = import.meta.glob('../views/**/*.vue');

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      // 检查当前路由是否是打印页面
      const currentPath = window.location.pathname;
      const isPrintPage = currentPath.includes('/bill/print/');

      // 如果不是打印页面，才显示加载提示
      if (!isPrintPage) {
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
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

export { generateAccess };

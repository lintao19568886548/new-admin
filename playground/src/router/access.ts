import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { message } from 'ant-design-vue';

import { getAllMenusApi } from '#/api';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';
import { useMenuStore } from '#/store/menu';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');
const missingRouteComponent = '/_core/fallback/route-placeholder';

function normalizeMenuComponents(
  menus: any[],
  options: {
    layoutKeys: Set<string>;
    pageKeys: Set<string>;
  },
): any[] {
  return menus.map((menu) => {
    const normalizedMenu = { ...menu };
    const component = normalizedMenu.component;

    if (typeof component === 'string') {
      const normalizedComponent = component.startsWith('/')
        ? component
        : `/${component}`;
      const pageKey = `../views${normalizedComponent}.vue`;
      const isKnownComponent =
        options.layoutKeys.has(component) ||
        options.layoutKeys.has(normalizedComponent) ||
        options.pageKeys.has(pageKey);

      if (!isKnownComponent) {
        console.warn(
          `[router] Missing route component "${component}" for path "${normalizedMenu.path}". Falling back to ${missingRouteComponent}.`,
        );
        normalizedMenu.component = missingRouteComponent;
      }
    }

    if (Array.isArray(normalizedMenu.children)) {
      normalizedMenu.children = normalizeMenuComponents(
        normalizedMenu.children,
        options,
      );
    }

    return normalizedMenu;
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
      const menus = normalizeMenuComponents(await getAllMenusApi(), {
        layoutKeys: new Set(Object.keys(layoutMap)),
        pageKeys: new Set(Object.keys(pageMap)),
      });
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

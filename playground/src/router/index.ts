import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';

import { resetStaticRoutes } from '@vben/utils';

import { createRouterGuard } from './guard';
import { routes } from './routes';

const DYNAMIC_IMPORT_RELOAD_KEY = '__vben_dynamic_import_reload_at__';
const DYNAMIC_IMPORT_RELOAD_COOLDOWN = 15_000;

function isDynamicImportLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    message,
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showDynamicImportLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  document.body.innerHTML = `
    <div style="box-sizing:border-box;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:520px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;padding:28px;box-shadow:0 20px 60px rgba(15,23,42,.12);">
        <h1 style="margin:0 0 12px;font-size:20px;">页面资源加载失败</h1>
        <p style="margin:0 0 12px;line-height:1.7;color:#475569;">页面资源暂时无法加载。请检查网络后刷新页面；如果仍无法恢复，请重启应用后再试。</p>
        <pre style="max-height:160px;overflow:auto;border-radius:10px;background:#f1f5f9;padding:12px;font-size:12px;white-space:pre-wrap;color:#334155;">${escapeHtml(message)}</pre>
      </div>
    </div>
  `;
}

/**
 *  @zh_CN 创建vue-router实例
 */
const router = createRouter({
  history:
    import.meta.env.VITE_ROUTER_HISTORY === 'hash'
      ? createWebHashHistory(import.meta.env.VITE_BASE)
      : createWebHistory(import.meta.env.VITE_BASE),
  // 应该添加到路由的初始路由列表。
  routes,
  scrollBehavior: (to, _from, savedPosition) => {
    if (savedPosition) {
      return savedPosition;
    }
    return to.hash ? { behavior: 'smooth', el: to.hash } : { left: 0, top: 0 };
  },
  // 是否应该禁止尾部斜杠。
  // strict: true,
});

router.onError((error) => {
  if (!isDynamicImportLoadError(error)) {
    return;
  }

  const now = Date.now();
  const lastReloadAt = Number(
    sessionStorage.getItem(DYNAMIC_IMPORT_RELOAD_KEY) || 0,
  );
  if (
    Number.isFinite(lastReloadAt) &&
    now - lastReloadAt < DYNAMIC_IMPORT_RELOAD_COOLDOWN
  ) {
    showDynamicImportLoadError(error);
    return;
  }

  sessionStorage.setItem(DYNAMIC_IMPORT_RELOAD_KEY, String(now));
  window.setTimeout(() => window.location.reload(), 800);
});

router.afterEach(() => {
  sessionStorage.removeItem(DYNAMIC_IMPORT_RELOAD_KEY);
});

const resetRoutes = () => resetStaticRoutes(router, routes);

// 创建路由守卫
createRouterGuard(router);

export { resetRoutes, router };

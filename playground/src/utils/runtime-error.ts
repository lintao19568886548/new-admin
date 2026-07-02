import type { App } from 'vue';

import {
  getErrorMessage,
  isDynamicImportLoadError,
} from '#/utils/retry-import';

declare global {
  interface Window {
    __vbenClearAppLoadingTimeout__?: () => void;
    __vbenRuntimeErrorHandlersInstalled__?: boolean;
  }
}

const RESOURCE_RELOAD_KEY = '__vben_resource_error_reload_at__';
const RESOURCE_RELOAD_COOLDOWN = 15_000;

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function clearStartupLoadingTimeout() {
  window.__vbenClearAppLoadingTimeout__?.();
}

function getRuntimeMetadata() {
  return {
    href: window.location.href,
    onLine: window.navigator.onLine,
    userAgent: window.navigator.userAgent,
  };
}

function reportRuntimeError(
  source: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  console.error(`[runtime-error:${source}]`, {
    error,
    extra,
    metadata: getRuntimeMetadata(),
  });
}

function renderRecoverableError(options: {
  description: string;
  error?: unknown;
  title: string;
}) {
  clearStartupLoadingTimeout();

  const message = options.error ? getErrorMessage(options.error) : '';
  document.body.innerHTML = `
    <div style="box-sizing:border-box;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="box-sizing:border-box;width:100%;max-width:520px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;padding:28px;box-shadow:0 18px 48px rgba(15,23,42,.12);">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;">${escapeHtml(options.title)}</h1>
        <p style="margin:0 0 16px;line-height:1.7;color:#475569;">${escapeHtml(options.description)}</p>
        <button type="button" onclick="window.location.reload()" style="height:38px;border:0;border-radius:6px;background:#1677ff;padding:0 16px;color:#fff;cursor:pointer;">重新加载</button>
        ${
          message
            ? `<pre style="box-sizing:border-box;max-height:160px;overflow:auto;margin:16px 0 0;border-radius:6px;background:#f1f5f9;padding:12px;font-size:12px;line-height:1.6;white-space:pre-wrap;color:#334155;">${escapeHtml(message)}</pre>`
            : ''
        }
      </div>
    </div>
  `;
}

function reloadOnceOrRender(error: unknown, description: string) {
  const now = Date.now();
  const lastReloadAt = Number(sessionStorage.getItem(RESOURCE_RELOAD_KEY) || 0);

  if (
    Number.isFinite(lastReloadAt) &&
    now - lastReloadAt < RESOURCE_RELOAD_COOLDOWN
  ) {
    renderRecoverableError({
      description,
      error,
      title: '页面资源加载失败',
    });
    return true;
  }

  sessionStorage.setItem(RESOURCE_RELOAD_KEY, String(now));
  window.setTimeout(() => window.location.reload(), 800);
  return true;
}

function handleDynamicImportLoadError(error: unknown) {
  if (!isDynamicImportLoadError(error)) {
    return false;
  }

  reportRuntimeError('dynamic-import', error);
  return reloadOnceOrRender(
    error,
    '系统资源可能已更新，或当前网络暂时不稳定。页面将尝试自动刷新一次；如果仍未恢复，请手动重新加载。',
  );
}

function getFailedAssetUrl(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return '';
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'script') {
    return (target as HTMLScriptElement).src || '';
  }

  if (tagName !== 'link') {
    return '';
  }

  const link = target as HTMLLinkElement;
  const rel = String(link.rel || '').toLowerCase();
  if (
    rel.includes('stylesheet') ||
    rel.includes('modulepreload') ||
    rel.includes('preload')
  ) {
    return link.href || '';
  }

  return '';
}

function isRecoverableAssetUrl(url: string) {
  return /\.(?:css|js|mjs)(?:[?#].*)?$/i.test(url);
}

function handleAssetLoadError(url: string) {
  if (!isRecoverableAssetUrl(url)) {
    return false;
  }

  const error = new Error(`Asset load failed: ${url}`);
  reportRuntimeError('asset-load', error, { url });
  return reloadOnceOrRender(
    error,
    '关键页面资源下载失败，可能是弱网、缓存版本不一致或发布中资源切换导致。页面将尝试自动刷新一次；如果仍未恢复，请手动重新加载。',
  );
}

function clearResourceReloadFlag() {
  sessionStorage.removeItem(RESOURCE_RELOAD_KEY);
}

function setupGlobalRuntimeErrorHandlers() {
  if (window.__vbenRuntimeErrorHandlersInstalled__) {
    return;
  }

  window.addEventListener(
    'error',
    (event) => {
      const assetUrl = getFailedAssetUrl(event.target);
      if (assetUrl) {
        handleAssetLoadError(assetUrl);
        return;
      }

      const error = event.error || event.message;
      reportRuntimeError('window', error);
      handleDynamicImportLoadError(error);
    },
    true,
  );

  window.addEventListener('unhandledrejection', (event) => {
    reportRuntimeError('unhandledrejection', event.reason);

    if (handleDynamicImportLoadError(event.reason)) {
      event.preventDefault();
    }
  });

  window.__vbenRuntimeErrorHandlersInstalled__ = true;
}

function setupVueRuntimeErrorHandler(app: App) {
  app.config.errorHandler = (error, instance, info) => {
    reportRuntimeError('vue', error, { info, instance });
    handleDynamicImportLoadError(error);
  };
}

function showBootstrapError(error: unknown) {
  reportRuntimeError('bootstrap', error);
  renderRecoverableError({
    description:
      '系统启动失败，可能是网络资源未加载完成、浏览器兼容问题或脚本运行异常。请重新加载页面后再试。',
    error,
    title: '系统启动失败',
  });
}

export {
  clearResourceReloadFlag,
  clearStartupLoadingTimeout,
  handleAssetLoadError,
  handleDynamicImportLoadError,
  setupGlobalRuntimeErrorHandlers,
  setupVueRuntimeErrorHandler,
  showBootstrapError,
};

import type { PluginOption } from 'vite';

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPackageJSON } from '@vben/node-utils';

/**
 * 用于生成将loading样式注入到项目中
 * 为多app提供loading样式，无需在每个 app -> index.html单独引入
 */
async function viteInjectAppLoadingPlugin(
  isBuild: boolean,
  env: Record<string, any> = {},
  loadingTemplate = 'loading.html',
): Promise<PluginOption | undefined> {
  const loadingHtml = await getLoadingRawByHtmlTemplate(loadingTemplate);
  const { version } = await readPackageJSON(process.cwd());
  const envRaw = isBuild ? 'prod' : 'dev';
  const cacheName = `'${env.VITE_APP_NAMESPACE}-${version}-${envRaw}-preferences-theme'`;

  // 获取缓存的主题
  // 保证黑暗主题下，刷新页面时，loading也是黑暗主题
  const injectScript = `
  <script data-app-loading="inject-js">
  var theme = localStorage.getItem(${cacheName});
  var userAgent = navigator.userAgent || '';
  var platform = navigator.platform || '';
  var maxTouchPoints = navigator.maxTouchPoints || 0;
  var isIOS = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  var isWechat = /MicroMessenger/i.test(userAgent);
  var isNativeWebView = /wv|Version\\/\\d+\\.\\d+.*Mobile.*Safari/i.test(userAgent);
  var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var effectiveType = connection && connection.effectiveType;
  var isSlowNetwork = /(^2g$|slow-2g|3g)/i.test(effectiveType || '');
  var rootClassList = document.documentElement.classList;
  rootClassList.toggle('dark', /dark/.test(theme));
  rootClassList.toggle('is-ios', isIOS);
  rootClassList.toggle('is-wechat-webview', isWechat);
  rootClassList.toggle('is-native-webview', isNativeWebView);
  rootClassList.toggle('is-slow-network', isSlowNetwork);
  rootClassList.toggle('is-offline', navigator.onLine === false);
  window.__vbenReloadApp = function() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('__vben_refresh', String(Date.now()));
      window.location.replace(url.toString());
    } catch (error) {
      window.location.reload();
    }
  };
  function updateOnlineState() {
    rootClassList.toggle('is-offline', navigator.onLine === false);
    var loading = document.getElementById('__app-loading__');
    if (loading) {
      loading.classList.toggle('offline', navigator.onLine === false);
    }
  }
  window.addEventListener('online', updateOnlineState);
  window.addEventListener('offline', updateOnlineState);
  var slowDelay = isIOS || isWechat || isSlowNetwork ? 4500 : 8000;
  var stalledDelay = isIOS || isWechat || isSlowNetwork ? 12000 : 18000;
  window.__vbenAppLoadingTimer__ = window.setTimeout(function() {
    var loading = document.getElementById('__app-loading__');
    if (loading) {
      loading.classList.add('slow');
    }
  }, slowDelay);
  window.__vbenAppLoadingStalledTimer__ = window.setTimeout(function() {
    var loading = document.getElementById('__app-loading__');
    if (loading) {
      loading.classList.add('slow');
      loading.classList.add('stalled');
    }
  }, stalledDelay);
  window.__vbenClearAppLoadingTimeout__ = function() {
    if (window.__vbenAppLoadingTimer__) {
      window.clearTimeout(window.__vbenAppLoadingTimer__);
      window.__vbenAppLoadingTimer__ = null;
    }
    if (window.__vbenAppLoadingStalledTimer__) {
      window.clearTimeout(window.__vbenAppLoadingStalledTimer__);
      window.__vbenAppLoadingStalledTimer__ = null;
    }
  };
</script>
`;

  if (!loadingHtml) {
    return;
  }

  return {
    enforce: 'pre',
    name: 'vite:inject-app-loading',
    transformIndexHtml: {
      handler(html) {
        const re = /<body\s*>/;
        html = html.replace(re, `<body>${injectScript}${loadingHtml}`);
        return html;
      },
      order: 'pre',
    },
  };
}

/**
 * 用于获取loading的html模板
 */
async function getLoadingRawByHtmlTemplate(loadingTemplate: string) {
  // 支持在app内自定义loading模板，模版参考default-loading.html即可
  let appLoadingPath = join(process.cwd(), loadingTemplate);

  if (!fs.existsSync(appLoadingPath)) {
    const __dirname = fileURLToPath(new URL('.', import.meta.url));
    appLoadingPath = join(__dirname, './default-loading.html');
  }

  return await fsp.readFile(appLoadingPath, 'utf8');
}

export { viteInjectAppLoadingPlugin };

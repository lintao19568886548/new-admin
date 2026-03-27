<script lang="ts" setup>
import { computed, onMounted, onUnmounted, watch } from 'vue';

import { useAntdDesignTokens } from '@vben/hooks';
import { preferences, usePreferences } from '@vben/preferences';

import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App, ConfigProvider, message, theme } from 'ant-design-vue';

import { antdLocale } from '#/locales';
import { router } from '#/router';
import { bootstrapWechatRuntimeDetection } from '#/utils/wechat-jssdk';

import PrivacyPolicyModal from './components/PrivacyPolicyModal.vue';

defineOptions({ name: 'App' });

const { isDark } = usePreferences();
const { tokens } = useAntdDesignTokens();
let appUrlOpenListener: null | { remove: () => Promise<void> } = null;
let stopWechatRuntimeDetection: (() => void) | null = null;
const ALLOWED_DEEP_LINK_PATTERNS = [
  /^\/home$/,
  /^\/rental\/factory$/,
  /^\/rental\/factory\/detail\/[^/]+$/,
];
const DEFAULT_DEEP_LINK_PATH = '/home';

async function syncStatusBarStyle() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  await StatusBar.setStyle({
    style: isDark.value ? Style.Dark : Style.Light,
  });
  await StatusBar.setBackgroundColor({
    color: isDark.value ? '#000000ff' : '#ffffffff',
  });
}

const tokenTheme = computed(() => {
  const algorithm = isDark.value
    ? [theme.darkAlgorithm]
    : [theme.defaultAlgorithm];

  // antd 紧凑模式算法
  if (preferences.app.compact) {
    algorithm.push(theme.compactAlgorithm);
  }

  return {
    algorithm,
    token: tokens,
  };
});

function resolveDeepLinkTarget(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const isHttpLink =
      parsed.protocol === 'http:' || parsed.protocol === 'https:';
    const fullPath = isHttpLink
      ? parsed.pathname
      : `${parsed.host ? `/${parsed.host}` : ''}${parsed.pathname}`;

    const isAllowedDeepLinkPath = (pathname: string) =>
      ALLOWED_DEEP_LINK_PATTERNS.some((pattern) => pattern.test(pathname));

    const normalizeAndWhitelist = (inputPath: string) => {
      const normalizedInput = inputPath.startsWith('/')
        ? inputPath
        : `/${inputPath}`;

      try {
        const normalizedUrl = new URL(
          normalizedInput,
          'https://deep-link.local',
        );
        const { hash, pathname, search } = normalizedUrl;
        if (!isAllowedDeepLinkPath(pathname)) {
          return DEFAULT_DEEP_LINK_PATH;
        }
        return `${pathname}${search}${hash}`;
      } catch (error) {
        console.warn('规范化深链目标失败:', error);
        return DEFAULT_DEEP_LINK_PATH;
      }
    };

    if (fullPath.startsWith('/ul/')) {
      const target = parsed.searchParams.get('target');
      if (target) {
        return normalizeAndWhitelist(target);
      }
      return DEFAULT_DEEP_LINK_PATH;
    }

    return normalizeAndWhitelist(`${fullPath}${parsed.search}${parsed.hash}`);
  } catch (error) {
    console.warn('解析深链失败:', error);
    return DEFAULT_DEEP_LINK_PATH;
  }
}

async function handleDeepLink(rawUrl: string) {
  const targetPath = resolveDeepLinkTarget(rawUrl);
  if (!targetPath) {
    return;
  }
  await router.isReady();
  if (router.currentRoute.value.fullPath === targetPath) {
    return;
  }
  await router.push(targetPath).catch((error) => {
    console.warn('深链路由跳转失败:', error);
  });
}

/**
 * @function configureStatusBar
 * @description 配置原生状态栏。 (此函数将被移除)
 */
// const configureStatusBar = async () => {
//   if (Capacitor.isNativePlatform()) {
//     try {
//       // 1. 确保状态栏是可见的 (如果之前隐藏过)
//       await StatusBar.show();

//       // 2. 设置状态栏覆盖 WebView
//       await StatusBar.setOverlaysWebView({ overlay: true });

//       console.warn(
//         '状态栏已配置为覆盖应用内容 (overlay: true)，由原生代码处理内边距',
//       );
//     } catch (error) {
//       console.error('配置状态栏失败', error);
//     }
//   }
// };

// 组件挂载后执行
onMounted(async () => {
  stopWechatRuntimeDetection = bootstrapWechatRuntimeDetection();

  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await syncStatusBarStyle();

      appUrlOpenListener = await CapacitorApp.addListener(
        'appUrlOpen',
        ({ url }) => {
          void handleDeepLink(url);
        },
      );

      const launchUrl = await CapacitorApp.getLaunchUrl();
      if (launchUrl?.url) {
        void handleDeepLink(launchUrl.url);
      }
    } catch (error) {
      console.warn('设置状态栏覆盖模式失败:', error);
    }
  }

  message.config({
    top: 'calc(var(--app-safe-area-top) + 8px)',
  });
});

onUnmounted(() => {
  if (stopWechatRuntimeDetection) {
    stopWechatRuntimeDetection();
    stopWechatRuntimeDetection = null;
  }

  if (appUrlOpenListener) {
    void appUrlOpenListener.remove();
    appUrlOpenListener = null;
  }
});

watch(isDark, () => {
  syncStatusBarStyle().catch((error) => {
    console.warn('同步状态栏样式失败:', error);
  });
});
</script>

<template>
  <ConfigProvider :locale="antdLocale" :theme="tokenTheme">
    <App>
      <RouterView />
      <PrivacyPolicyModal />
    </App>
  </ConfigProvider>
</template>

<style>
:root {
  --app-safe-area-top: var(--ion-safe-area-top, env(safe-area-inset-top, 0px));
  --app-safe-area-right: var(
    --ion-safe-area-right,
    env(safe-area-inset-right, 0px)
  );
  --app-safe-area-bottom: var(
    --ion-safe-area-bottom,
    env(safe-area-inset-bottom, 0px)
  );
  --app-safe-area-left: var(
    --ion-safe-area-left,
    env(safe-area-inset-left, 0px)
  );
}

.ant-app {
  box-sizing: border-box;
}
</style>

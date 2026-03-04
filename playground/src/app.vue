<script lang="ts" setup>
import { computed, onMounted } from 'vue';

import { useAntdDesignTokens } from '@vben/hooks';
import { preferences, usePreferences } from '@vben/preferences';

import { App, ConfigProvider, message, theme } from 'ant-design-vue';

import { antdLocale } from '#/locales';

import PrivacyPolicyModal from './components/PrivacyPolicyModal.vue';

defineOptions({ name: 'App' });

const { isDark } = usePreferences();
const { tokens } = useAntdDesignTokens();

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
onMounted(() => {
  message.config({
    top: 'calc(var(--app-safe-area-top) + 8px)',
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

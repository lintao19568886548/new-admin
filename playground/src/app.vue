<script lang="ts" setup>
import { computed, onMounted } from 'vue'; // onMounted 可能不再需要，除非有其他用途

import { useAntdDesignTokens } from '@vben/hooks';
import { preferences, usePreferences } from '@vben/preferences';

// 导入 Capacitor 相关模块
// import { Capacitor } from '@capacitor/core'; // 如果 configureStatusBar 是唯一使用它的地方，可以移除
// import { StatusBar } from '@capacitor/status-bar'; // 如果 configureStatusBar 是唯一使用它的地方，可以移除
import { App, ConfigProvider, theme } from 'ant-design-vue';

import { antdLocale } from '#/locales';

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
  // configureStatusBar(); // <-- 移除此调用
  // 如果 onMounted 没有其他逻辑，可以整个移除 onMounted 及其导入
});
</script>

<template>
  <ConfigProvider :locale="antdLocale" :theme="tokenTheme">
    <App>
      <RouterView />
    </App>
  </ConfigProvider>
</template>

<style>
/*
  适配 Android 15+ Edge-to-Edge 特性以及其他平台的安全区域。
  通过 CSS safe-area-inset-* 环境变量，为应用内容提供动态内边距，
  确保内容不会与状态栏、导航栏或设备刘海等区域重叠。
*/
.ant-app {
  /* antd.css 已经为 .ant-app 设置了 width: 100%; height: 100%; */

  /* 添加 box-sizing: border-box; 确保 padding 不会撑大元素原有尺寸 */
  box-sizing: border-box;
  padding: env(safe-area-inset-top, 0) env(safe-area-inset-right, 0)
    env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0);
}
</style>

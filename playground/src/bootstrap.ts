import { createApp, watchEffect } from 'vue';

import { registerAccessDirective } from '@vben/access';
import { initTippy, registerLoadingDirective } from '@vben/common-ui';
import { MotionPlugin } from '@vben/plugins/motion';
import { preferences } from '@vben/preferences';
import { initStores } from '@vben/stores';
import '@vben/styles';
import '@vben/styles/antd';

// Ionic Vue 配置
import { IonicVue } from '@ionic/vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { useTitle } from '@vueuse/core';
import { createHead } from '@vueuse/head';

import { $t, setupI18n } from '#/locales';
import { setupNeutralErrorFeedback } from '#/utils/neutral-feedback';
import { setupVueRuntimeErrorHandler } from '#/utils/runtime-error';

import { initComponentAdapter } from './adapter/component';
import App from './app.vue';

// import '@ionic/vue/css/core.css';
// import '@ionic/vue/css/normalize.css';
// import '@ionic/vue/css/structure.css';
// import '@ionic/vue/css/typography.css';
// import '@ionic/vue/css/padding.css';
// import '@ionic/vue/css/float-elements.css';
// import '@ionic/vue/css/text-alignment.css';
// import '@ionic/vue/css/text-transformation.css';
// import '@ionic/vue/css/flex-utils.css';
// import '@ionic/vue/css/display.css';

async function bootstrap(namespace: string) {
  setupNeutralErrorFeedback();

  // 初始化组件适配器
  await initComponentAdapter();

  // // 设置弹窗的默认配置
  // setDefaultModalProps({
  //   fullscreenButton: false,
  // });
  // // 设置抽屉的默认配置
  // setDefaultDrawerProps({
  //   // zIndex: 1020,
  // });

  const app = createApp(App);
  setupVueRuntimeErrorHandler(app);

  // 注册v-loading指令
  registerLoadingDirective(app, {
    loading: 'loading', // 在这里可以自定义指令名称，也可以明确提供false表示不注册这个指令
    spinning: 'spinning',
  });

  // 国际化 i18n 配置
  await setupI18n(app);

  const { router } = await import('#/router');

  // 配置 pinia-tore
  await initStores(app, { namespace });

  // 安装权限指令
  registerAccessDirective(app);

  // 初始化 tippy
  initTippy(app);

  // 配置@vueuse/head
  const head = createHead();
  app.use(head);

  // 配置路由及路由守卫
  app.use(router);

  // 配置 Ionic Vue
  app.use(IonicVue, {
    mode: 'md', // 使用 Material Design 样式
  });

  // 配置@tanstack/vue-query
  app.use(VueQueryPlugin);

  // 配置Motion插件
  app.use(MotionPlugin);

  // 动态更新标题
  watchEffect(() => {
    if (preferences.app.dynamicTitle) {
      const routeTitle = router.currentRoute.value.meta?.title;
      const pageTitle =
        (routeTitle ? `${$t(routeTitle)} - ` : '') + preferences.app.name;
      useTitle(pageTitle);
    }
  });

  app.mount('#app');
}

export { bootstrap };

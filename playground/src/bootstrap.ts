import { createApp, watchEffect } from 'vue';

import { registerAccessDirective } from '@vben/access';
import { preferences } from '@vben/preferences';
import { initStores } from '@vben/stores';
import '@vben/styles';

import { $t, setupI18n } from '#/locales';
import { isNativeRuntime } from '#/utils/native-runtime';
import { setupVueRuntimeErrorHandler } from '#/utils/runtime-error';

import { setAppInstance } from './app-context';
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
  // // 设置弹窗的默认配置
  // setDefaultModalProps({
  //   fullscreenButton: false,
  // });
  // // 设置抽屉的默认配置
  // setDefaultDrawerProps({
  //   // zIndex: 1020,
  // });

  const app = createApp(App);
  setAppInstance(app);
  setupVueRuntimeErrorHandler(app);

  // 国际化 i18n 配置
  await setupI18n(app);

  const { router } = await import('#/router');

  // 配置 pinia-tore
  await initStores(app, { namespace });

  // 安装权限指令
  registerAccessDirective(app);

  // 配置路由及路由守卫
  app.use(router);

  if (isNativeRuntime()) {
    const { IonicVue } = await import('@ionic/vue');
    app.use(IonicVue, {
      mode: 'md',
    });
  }

  // 动态更新标题
  watchEffect(() => {
    if (preferences.app.dynamicTitle) {
      const routeTitle = router.currentRoute.value.meta?.title;
      const pageTitle =
        (routeTitle ? `${$t(routeTitle)} - ` : '') + preferences.app.name;
      document.title = pageTitle;
    }
  });

  app.mount('#app');
}

export { bootstrap };

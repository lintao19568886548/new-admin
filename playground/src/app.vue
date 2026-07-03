<script lang="ts" setup>
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { usePreferences } from '@vben/preferences';

import { setupMobileRuntimeAdapter } from '#/utils/mobile-runtime-adapter';
import { isNativeRuntime } from '#/utils/native-runtime';
import {
  OPEN_PRIVACY_POLICY_EVENT,
  OPEN_SERVICE_AGREEMENT_EVENT,
  PRIVACY_POLICY_AGREED_KEY,
} from '#/utils/policy-actions';

defineOptions({ name: 'App' });

type CapacitorAppModule = typeof import('@capacitor/app');
type CapacitorStatusBarModule = typeof import('@capacitor/status-bar');

interface NativeRuntime {
  CapacitorApp: CapacitorAppModule['App'];
  StatusBar: CapacitorStatusBarModule['StatusBar'];
  Style: CapacitorStatusBarModule['Style'];
}

const { isDark } = usePreferences();
const route = useRoute();
const router = useRouter();
let appUrlOpenListener: null | { remove: () => Promise<void> } = null;
let nativeRuntimePromise: null | Promise<NativeRuntime | null> = null;
let stopMobileRuntimeAdapter: (() => void) | null = null;
let stopWechatRuntimeDetection: (() => void) | null = null;
const shouldRenderPrivacyPolicy = ref(false);
const initialPolicyDialog = ref<'privacy' | 'service'>();
const policyDialogRenderKey = ref(0);
const PrivacyPolicyModal = defineAsyncComponent(
  () => import('./components/PrivacyPolicyModal.vue'),
);
const AntdAppProvider = defineAsyncComponent(
  () => import('./components/AntdAppProvider.vue'),
);
const ALLOWED_DEEP_LINK_PATTERNS = [
  /^\/home$/,
  /^\/rental\/factory$/,
  /^\/rental\/factory\/detail\/[^/]+$/,
];
const DEFAULT_DEEP_LINK_PATH = '/home';

async function getNativeRuntime() {
  if (!isNativeRuntime()) {
    return null;
  }

  nativeRuntimePromise ??= import('@capacitor/core')
    .then(async ({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) {
        return null;
      }

      const [capacitorApp, statusBar] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/status-bar'),
      ]);

      return {
        CapacitorApp: capacitorApp.App,
        StatusBar: statusBar.StatusBar,
        Style: statusBar.Style,
      };
    })
    .catch((error) => {
      console.warn('加载原生运行时失败:', error);
      return null;
    });

  return await nativeRuntimePromise;
}

const shouldUseAntdProvider = computed(() => {
  if (!route.name) {
    return false;
  }
  return !route.matched.some((matchedRoute) => {
    return matchedRoute.name === 'Authentication';
  });
});

async function syncStatusBarStyle() {
  const nativeRuntime = await getNativeRuntime();
  if (!nativeRuntime) {
    return;
  }

  await nativeRuntime.StatusBar.setStyle({
    style: isDark.value ? nativeRuntime.Style.Dark : nativeRuntime.Style.Light,
  });
  await nativeRuntime.StatusBar.setBackgroundColor({
    color: isDark.value ? '#000000ff' : '#ffffffff',
  });
}

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

async function setupWechatRuntimeDetection() {
  if (!/MicroMessenger/i.test(navigator.userAgent || '')) {
    return;
  }

  const { bootstrapWechatRuntimeDetection } =
    await import('#/utils/wechat-jssdk');
  stopWechatRuntimeDetection = bootstrapWechatRuntimeDetection();
}

function isPrivacyPolicyAgreed() {
  if (typeof window === 'undefined') {
    return true;
  }

  return localStorage.getItem(PRIVACY_POLICY_AGREED_KEY) === 'true';
}

function loadPrivacyPolicyDialog(initialOpen?: 'privacy' | 'service') {
  initialPolicyDialog.value = initialOpen;
  shouldRenderPrivacyPolicy.value = true;
  policyDialogRenderKey.value += 1;
}

function openPrivacyPolicyDialog() {
  loadPrivacyPolicyDialog('privacy');
}

function openServiceAgreementDialog() {
  loadPrivacyPolicyDialog('service');
}

function bindPolicyDialogEvents() {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener(OPEN_PRIVACY_POLICY_EVENT, openPrivacyPolicyDialog);
  window.addEventListener(
    OPEN_SERVICE_AGREEMENT_EVENT,
    openServiceAgreementDialog,
  );
}

function unbindPolicyDialogEvents() {
  if (typeof window === 'undefined') {
    return;
  }

  window.removeEventListener(
    OPEN_PRIVACY_POLICY_EVENT,
    openPrivacyPolicyDialog,
  );
  window.removeEventListener(
    OPEN_SERVICE_AGREEMENT_EVENT,
    openServiceAgreementDialog,
  );
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
  stopMobileRuntimeAdapter = setupMobileRuntimeAdapter();
  bindPolicyDialogEvents();

  if (!isPrivacyPolicyAgreed()) {
    loadPrivacyPolicyDialog();
  }

  void setupWechatRuntimeDetection().catch((error) => {
    console.warn('微信运行环境检测初始化失败:', error);
  });

  const nativeRuntime = await getNativeRuntime();
  if (nativeRuntime) {
    try {
      await nativeRuntime.StatusBar.setOverlaysWebView({ overlay: false });
      await syncStatusBarStyle();

      appUrlOpenListener = await nativeRuntime.CapacitorApp.addListener(
        'appUrlOpen',
        ({ url }) => {
          void handleDeepLink(url);
        },
      );

      const launchUrl = await nativeRuntime.CapacitorApp.getLaunchUrl();
      if (launchUrl?.url) {
        void handleDeepLink(launchUrl.url);
      }
    } catch (error) {
      console.warn('设置状态栏覆盖模式失败:', error);
    }
  }
});

onUnmounted(() => {
  unbindPolicyDialogEvents();

  if (stopMobileRuntimeAdapter) {
    stopMobileRuntimeAdapter();
    stopMobileRuntimeAdapter = null;
  }

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

watch(
  () => route.path,
  (path) => {
    document.body.classList.toggle(
      'is-investment-route',
      path.startsWith('/investment'),
    );
  },
  { immediate: true },
);
</script>

<template>
  <AntdAppProvider v-if="shouldUseAntdProvider">
    <RouterView />
  </AntdAppProvider>
  <RouterView v-else />
  <PrivacyPolicyModal
    v-if="shouldRenderPrivacyPolicy"
    :key="policyDialogRenderKey"
    :initial-open="initialPolicyDialog"
  />
</template>

<style>
:root {
  --app-viewport-height: 100dvh;
  --app-keyboard-height: 0px;
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
</style>

<script lang="ts" setup>
import type { PluginListenerHandle } from '@capacitor/core';

import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Fallback, VbenButton } from '@vben/common-ui';
import { DEFAULT_HOME_PATH } from '@vben/constants';
import { ArrowLeft, LogOut } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { resetRoutes } from '#/router';
import { resolveUserHomePath } from '#/router/home-path';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Fallback404Demo' });

interface RecoverableMenu {
  children?: RecoverableMenu[];
  path?: string;
}

const FALLBACK_NOT_FOUND_NAME = 'FallbackNotFound';
const MOBILE_RECOVERY_PATHS = ['/home', '/workbench', '/profile'];
const router = useRouter();
const accessStore = useAccessStore();
const authStore = useAuthStore();
const userStore = useUserStore();
const actionLoading = ref(false);
const recoveryUnavailable = ref(false);
let backButtonListener: null | PluginListenerHandle = null;

function collectMenuPaths(menus: RecoverableMenu[]) {
  const paths: string[] = [];
  const queue = [...menus];

  while (queue.length > 0) {
    const menu = queue.shift();
    if (!menu) {
      continue;
    }
    if (menu.path) {
      paths.push(menu.path);
    }
    if (menu.children?.length) {
      queue.push(...menu.children);
    }
  }

  return paths;
}

function isAvailableRoutePath(path: string) {
  const resolved = router.resolve(path);
  return (
    resolved.matched.length > 0 && resolved.name !== FALLBACK_NOT_FOUND_NAME
  );
}

function resolveRecoveryPath(homePath?: string) {
  if (window.innerWidth < 768) {
    return MOBILE_RECOVERY_PATHS.find((path) => isAvailableRoutePath(path));
  }

  const candidates = [
    resolveUserHomePath(homePath),
    '/home',
    DEFAULT_HOME_PATH,
    ...collectMenuPaths(accessStore.accessMenus),
  ];

  return (
    candidates.find((path) => path && isAvailableRoutePath(path)) ||
    resolveUserHomePath(homePath)
  );
}

const actionText = computed(() => {
  if (actionLoading.value) {
    return recoveryUnavailable.value ? '正在登出' : '正在返回';
  }
  return recoveryUnavailable.value ? '登出当前账号' : '返回首页';
});

async function logoutCurrentAccount() {
  if (actionLoading.value) {
    return;
  }

  actionLoading.value = true;
  try {
    await authStore.logout(false);
  } finally {
    actionLoading.value = false;
  }
}

async function restoreHome() {
  if (actionLoading.value) {
    return;
  }

  actionLoading.value = true;
  try {
    recoveryUnavailable.value = false;
    resetRoutes();
    const userInfo = await authStore.ensureSessionReady({
      forceRebuildAccess: true,
      forceRefreshUserInfo: true,
    });
    const recoveryPath = resolveRecoveryPath(
      userInfo?.homePath ?? userStore.userInfo?.homePath,
    );

    if (!recoveryPath) {
      recoveryUnavailable.value = true;
      return;
    }

    await router.replace(recoveryPath);
    if (router.currentRoute.value.name === FALLBACK_NOT_FOUND_NAME) {
      recoveryUnavailable.value = true;
    }
  } catch (error) {
    console.warn('恢复首页失败:', error);
    recoveryUnavailable.value = true;
  } finally {
    actionLoading.value = false;
  }
}

async function handlePrimaryAction() {
  if (recoveryUnavailable.value) {
    await logoutCurrentAccount();
    return;
  }

  await restoreHome();
}

async function handleBackButton() {
  if (recoveryUnavailable.value) {
    await logoutCurrentAccount();
    return;
  }

  await restoreHome();
}

onMounted(async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  backButtonListener = await App.addListener('backButton', () => {
    void handleBackButton();
  });
});

onUnmounted(() => {
  void backButtonListener?.remove();
});
</script>

<template>
  <Fallback status="404">
    <template #action>
      <VbenButton
        class="min-h-11 px-5"
        :loading="actionLoading"
        size="lg"
        :variant="recoveryUnavailable ? 'destructive' : 'default'"
        @click="handlePrimaryAction"
      >
        <LogOut
          v-if="recoveryUnavailable && !actionLoading"
          class="mr-2 size-4"
        />
        <ArrowLeft v-else-if="!actionLoading" class="mr-2 size-4" />
        {{ actionText }}
      </VbenButton>
    </template>
  </Fallback>
</template>

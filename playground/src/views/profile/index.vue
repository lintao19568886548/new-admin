<script lang="ts" setup>
import { computed } from 'vue';

import { VbenIcon } from '@vben/common-ui';
import { ChevronRight, LogOut, RotateCw, UserRoundPen } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Avatar, Card, List, ListItem, message, Modal } from 'ant-design-vue';
import semver from 'semver';

import { getLatestVersionApi } from '#/api/system';
import { useAuthStore } from '#/store';

const userStore = useUserStore();
const authStore = useAuthStore();

const userInfo = computed(() => userStore.userInfo);

async function handleCheckUpdate() {
  // Show loading message, which will be destroyed upon completion or error
  message.loading('正在检查更新...', 0);
  try {
    const { version: currentVersion } = await App.getInfo();

    // Fetch latest version info from the server.
    const {
      notes,
      url: updateUrl,
      version: latestVersion,
    } = await getLatestVersionApi();

    // Hide loading message
    message.destroy();

    // A simple version comparison. For more robust comparison, consider using a library like semver.
    if (semver.lt(currentVersion, latestVersion)) {
      Modal.confirm({
        cancelText: '稍后',
        centered: true,
        content: notes || '建议您立即更新以获得更好的体验。',
        okText: '立即更新',
        onOk: async () => {
          if (updateUrl) {
            await Browser.open({ url: updateUrl });
          } else {
            message.error('更新链接无效');
          }
        },
        title: `发现新版本 v${latestVersion}`,
      });
    } else {
      message.success(`当前已是最新版本 (v${currentVersion})`);
    }
  } catch (error) {
    message.destroy();
    const errorMessage =
      error instanceof Error ? error.message : '检查更新时发生错误';
    message.error(errorMessage);
  }
}

function handleLogout() {
  Modal.confirm({
    cancelText: '取消',
    centered: true,
    content: '您确定要退出登录吗？',
    okText: '确认',
    onOk: async () => {
      await authStore.logout(false);
      message.success('已退出登录');
    },
    title: '温馨提示',
  });
}

function handleEditProfile() {
  message.info('该功能正在开发中...');
}

const isNative = Capacitor.isNativePlatform();

const actions = computed(() => {
  const baseActions = [
    {
      handler: handleEditProfile,
      icon: UserRoundPen,
      title: '修改个人信息',
    },
    {
      handler: handleLogout,
      icon: LogOut,
      title: '退出登录',
    },
  ];

  if (isNative) {
    baseActions.splice(1, 0, {
      handler: handleCheckUpdate,
      icon: RotateCw,
      title: '检查更新',
    });
  }

  return baseActions;
});
</script>

<template>
  <div class="p-3">
    <Card :bordered="false" class="mb-3">
      <div class="flex flex-col items-center justify-center py-4">
        <Avatar :size="64" :src="userInfo?.avatar" />
        <div class="mt-3 text-lg font-semibold">
          {{ userInfo?.realName }}
        </div>
      </div>
    </Card>

    <Card :bordered="false">
      <List :data-source="actions">
        <template #renderItem="{ item }">
          <ListItem @click="item.handler">
            <div class="flex w-full items-center justify-between">
              <div class="flex items-center">
                <VbenIcon :icon="item.icon" class="mr-2" />
                <span>{{ item.title }}</span>
              </div>
              <VbenIcon :icon="ChevronRight" />
            </div>
          </ListItem>
        </template>
      </List>
    </Card>
  </div>
</template>

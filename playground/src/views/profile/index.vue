<script lang="ts" setup>
import { computed, ref } from 'vue';

import { VbenIcon } from '@vben/common-ui';
import { ChevronRight, LogOut, RotateCw, UserRoundPen } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Avatar, Card, List, ListItem, message, Modal } from 'ant-design-vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import semver from 'semver';

import { getLatestVersionApi } from '#/api/system';
import { useAuthStore } from '#/store';

const userStore = useUserStore();
const authStore = useAuthStore();

const userInfo = computed(() => userStore.userInfo);

const isUpdateModalVisible = ref(false);
const latestVersionInfo = ref({
  notes: '',
  url: '',
  version: '',
});

const sanitizedNotes = computed(() => {
  const dirty = marked(latestVersionInfo.value.notes || '');
  return DOMPurify.sanitize(dirty as string);
});

async function handleCheckUpdate() {
  // Show loading message, which will be destroyed upon completion or error
  message.loading('正在检查更新...', 0);
  try {
    const { version: currentVersion } = await App.getInfo();
    // const currentVersion = '1.0.0';

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
      latestVersionInfo.value = {
        notes,
        url: updateUrl,
        version: latestVersion,
      };
      isUpdateModalVisible.value = true;
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

async function handleUpdateModalOk() {
  if (latestVersionInfo.value.url) {
    await Browser.open({ url: latestVersionInfo.value.url });
  } else {
    message.error('更新链接无效');
  }
  isUpdateModalVisible.value = false;
}

function handleUpdateModalCancel() {
  isUpdateModalVisible.value = false;
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
// const isNative = true;

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

    <Modal
      v-model:open="isUpdateModalVisible"
      :title="`发现新版本 v${latestVersionInfo.version}`"
      centered
      cancel-text="稍后"
      ok-text="立即更新"
      width="90vw"
      @cancel="handleUpdateModalCancel"
      @ok="handleUpdateModalOk"
    >
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="update-notes-content" v-html="sanitizedNotes"></div>
    </Modal>
  </div>
</template>

<style scoped>
.update-notes-content {
  max-height: 70vh;
  overflow-y: auto;
  text-align: left;

  /* For Firefox */
  scrollbar-width: none;
}

.update-notes-content::-webkit-scrollbar {
  display: none;
}

/* Main headings (e.g., ✨ 新增功能) */
.update-notes-content :deep(h3) {
  padding-bottom: 8px;
  margin-top: 20px;
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid #f0f0f0;
}

.update-notes-content :deep(h3:first-child) {
  margin-top: 0;
}

/* Sub-headings (e.g., 全新的厂房管理模块) */
.update-notes-content :deep(h4) {
  margin-top: 16px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
}

/* Unordered lists for bullet points */
.update-notes-content :deep(ul) {
  padding-left: 20px;
  margin-bottom: 16px;
  list-style-type: disc;
}

.update-notes-content :deep(li) {
  margin-bottom: 6px;
  line-height: 1.6;
}
</style>

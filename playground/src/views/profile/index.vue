<script lang="ts" setup>
import type { ProgressStatus } from '@capacitor/file-transfer';

import { computed, onMounted, ref } from 'vue';

import { VbenIcon } from '@vben/common-ui';
import { ChevronRight, LogOut, RotateCw, UserRoundPen } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { FileTransfer } from '@capacitor/file-transfer';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  Avatar,
  Button,
  Card,
  List,
  ListItem,
  message,
  Modal,
  Progress,
} from 'ant-design-vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import semver from 'semver';

import { getLatestVersionApi } from '#/api/system';
import { useAuthStore } from '#/store';

const userStore = useUserStore();
const authStore = useAuthStore();

const userInfo = computed(() => userStore.userInfo);

const isUpdateModalVisible = ref(false);
const isDownloading = ref(false);
const downloadProgress = ref(0);
const downloadCancelled = ref(false);
const latestVersionInfo = ref({
  notes: '',
  url: '',
  version: '',
});

const sanitizedNotes = computed(() => {
  const dirty = marked(latestVersionInfo.value.notes || '');
  return DOMPurify.sanitize(dirty as string);
});

/**
 * 初始化通知功能（包括本地通知和推送通知）
 */
async function initNotifications() {
  if (Capacitor.getPlatform() === 'android') {
    try {
      // 请求本地通知权限
      const localPermStatus = await LocalNotifications.requestPermissions();
      console.warn('本地通知权限状态:', localPermStatus.display);

      const hasLocalNotification = localPermStatus.display === 'granted';

      return hasLocalNotification;
    } catch (error) {
      console.error('初始化通知功能失败:', error);
      return false;
    }
  }
  return false;
}

/**
 * 发送本地推送通知（用于调试）
 */
async function sendDebugNotification(title: string, body: string) {
  if (Capacitor.getPlatform() === 'android') {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            actionTypeId: '',
            attachments: [],
            body,
            extra: {},
            // 使用整数作为id,避免使用Date.now()可能产生的小数
            id: Math.floor(Math.random() * 100_000),
            schedule: { at: new Date(Date.now() + 100) }, // 100ms后显示
            sound: 'default',
            title,
          },
        ],
      });
    } catch (error) {
      console.error('发送调试通知失败:', error);
      // 如果本地通知失败，回退到普通消息提示
      message.info(`${title}: ${body}`);
    }
  } else {
    // 非Android平台使用消息提示
    message.info(`${title}: ${body}`);
  }
}

// 组件挂载时初始化通知功能
onMounted(async () => {
  if (isNative) {
    // 初始化通知功能
    await initNotifications();
  }
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

/**
 * 处理应用更新
 */
async function handleUpdateModalOk() {
  await handleApkDownload();
}

/**
 * 处理 APK 下载和安装
 */
async function handleApkDownload() {
  if (!latestVersionInfo.value.url) {
    message.error('更新链接无效');
    return;
  }

  isDownloading.value = true;
  downloadProgress.value = 0;
  downloadCancelled.value = false;

  try {
    // 生成文件名
    const fileName = `app-update-${latestVersionInfo.value.version}.apk`;

    sendDebugNotification('开始下载', '正在下载 APK 安装包...');

    // 获取应用数据目录的完整路径
    const { uri: dataDirectoryUri } = await Filesystem.getUri({
      directory: Directory.Data,
      path: '',
    });
    // 移除 file:// 前缀并构建完整路径
    const dataPath = dataDirectoryUri.replace('file://', '');
    const fullPath = `${dataPath}/${fileName}`;

    // 添加进度监听器
    const progressListener = await FileTransfer.addListener(
      'progress',
      (progress: ProgressStatus) => {
        if (
          !downloadCancelled.value &&
          progress.lengthComputable &&
          progress.contentLength > 0
        ) {
          const percent = Math.round(
            (progress.bytes / progress.contentLength) * 100,
          );
          downloadProgress.value = percent;
        }
      },
    );

    try {
      // 下载 APK 文件到应用目录
      const downloadResult = await FileTransfer.downloadFile({
        path: fullPath,
        progress: true,
        url: latestVersionInfo.value.url,
      });

      console.warn('下载完成，文件路径:', downloadResult.path);
    } finally {
      // 移除进度监听器
      await progressListener.remove();
    }

    if (downloadCancelled.value) {
      message.info('下载已取消');
      // 删除已下载的文件
      try {
        await Filesystem.deleteFile({
          directory: Directory.Data,
          path: fileName,
        });
      } catch (deleteError) {
        console.warn('删除已取消的文件失败:', deleteError);
      }
      return;
    }

    sendDebugNotification('下载完成', 'APK 下载完成，准备安装...');

    // 获取文件的 URI
    const fileUri = await Filesystem.getUri({
      directory: Directory.Data,
      path: fileName,
    });

    // 调用原生方法安装 APK
    if (Capacitor.isNativePlatform() && (window as any).AndroidInterface) {
      try {
        (window as any).AndroidInterface.installApk(fileUri.uri, fileName);
        message.success('正在安装 APK...');
      } catch (error) {
        console.error('调用原生安装方法失败:', error);
        message.error(`安装失败: ${error}`);
      }
    } else {
      message.success(`APK 下载完成，URI: ${fileUri.uri}`);
    }
  } catch (error) {
    console.error('APK 下载失败:', error);
    sendDebugNotification('下载失败', `APK 下载失败: ${error}`);
    message.error('应用更新失败，请稍后重试');
  } finally {
    isDownloading.value = false;
  }
}

/**
 * 取消下载
 */
function handleCancelDownload() {
  downloadCancelled.value = true;
  isDownloading.value = false;
  downloadProgress.value = 0;
  message.info('下载已取消');

  // 如果有正在下载的 APK 文件，会在 handleApkDownload 函数中处理删除
}

/**
 * 处理模态框取消
 */
function handleUpdateModalCancel() {
  if (isDownloading.value) {
    handleCancelDownload();
  }
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
      :cancel-text="isDownloading ? '取消下载' : '稍后'"
      :ok-text="isDownloading ? '下载中...' : '立即更新'"
      :ok-button-props="{ loading: isDownloading, disabled: isDownloading }"
      width="90vw"
      @cancel="handleUpdateModalCancel"
      @ok="handleUpdateModalOk"
    >
      <!-- 更新说明 -->

      <div v-if="!isDownloading">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="update-notes-content" v-html="sanitizedNotes"></div>
      </div>

      <!-- 下载进度界面 -->
      <div v-else class="download-progress-container">
        <div class="mb-4 text-center">
          <div class="mb-2 text-lg font-semibold">正在下载更新包...</div>
          <div class="mb-4 text-sm text-gray-600">
            下载进度: {{ downloadProgress }}%
          </div>
        </div>

        <Progress
          :percent="downloadProgress"
          :show-info="false"
          stroke-color="#1890ff"
          class="mb-4"
        />

        <div class="text-center">
          <Button type="default" danger @click="handleCancelDownload">
            取消下载
          </Button>
        </div>
      </div>
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

.download-progress-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 200px;
  padding: 20px 0;
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

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, watch } from 'vue';

import { useAccessStore } from '@vben/stores';

import { Capacitor } from '@capacitor/core';
import { Button, Modal, Progress } from 'ant-design-vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import {
  cancelDownload,
  checkAppUpdate,
  closeUpdateModal,
  downloadAndInstallApk,
  openAndroidAppMarketPage,
  triggerAppUpdate,
  updateState,
} from '#/utils/update-service';

defineOptions({ name: 'AutoUpdateChecker' });

const accessStore = useAccessStore();

// 是否已经执行过自动检查
let hasAutoChecked = false;

// 使用共享的更新状态
const {
  androidUpdateStrategy,
  androidVendorType,
  downloadProgress,
  isDownloading,
  isUpdateModalVisible,
  latestVersionInfo,
} = updateState;

// 计算属性：处理更新说明的HTML内容
const sanitizedNotes = computed(() => {
  const dirty = marked(latestVersionInfo.value.notes || '');
  return DOMPurify.sanitize(dirty as string);
});

const isIosNativePlatform = computed(
  () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios',
);

const isVendorAppMarketUpdate = computed(
  () =>
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android' &&
    androidUpdateStrategy.value === 'app-market',
);

const canForceDownloadPackage = computed(() => !!latestVersionInfo.value.url);

const appMarketName = computed(() => {
  if (androidVendorType.value === 'honor') {
    return '荣耀应用市场';
  }

  if (androidVendorType.value === 'huawei') {
    return '华为应用市场';
  }

  return '应用商店';
});

const updateOkText = computed(() => {
  if (isDownloading.value) {
    return '下载中...';
  }
  return isIosNativePlatform.value ? '前往更新' : '立即更新';
});

/**
 * 自动检查应用更新（静默检查，发现更新后显示确认弹窗）
 */
async function performAutoCheck() {
  if (hasAutoChecked) {
    return;
  }

  hasAutoChecked = true;

  try {
    // console.log('开始自动检查更新...');
    // 静默检查，不显示加载提示和成功提示，发现更新后显示确认弹窗
    await checkAppUpdate(false, false, false);
  } catch (error) {
    // 静默处理错误，不影响应用正常启动
    console.warn('自动检查更新失败:', error);
  }
}

/**
 * 处理应用更新
 */
async function handleUpdateModalOk() {
  await triggerAppUpdate();
}

/**
 * 跳转应用商店
 */
async function handleOpenAppMarket() {
  await openAndroidAppMarketPage();
}

/**
 * 华为/荣耀设备强制下载安装包
 */
async function handleForceDownloadPackage() {
  await downloadAndInstallApk();
}

/**
 * 取消下载
 */
function handleCancelDownload() {
  cancelDownload();
}

/**
 * 处理模态框取消
 */
function handleUpdateModalCancel() {
  closeUpdateModal();
}

/**
 * 检查是否可以执行自动更新检查
 * 条件：用户已登录（有accessToken即可）
 */
function checkCanAutoUpdate() {
  const canCheck = !!accessStore.accessToken;

  if (canCheck && !hasAutoChecked) {
    // 使用 nextTick 确保在下一个事件循环中执行，避免阻塞当前的路由导航
    nextTick(() => {
      setTimeout(() => {
        performAutoCheck();
      }, 0);
    });
  }
}

// 监听登录状态变化
const stopWatchAccess = watch(
  () => accessStore.accessToken,
  () => {
    checkCanAutoUpdate();
  },
  { immediate: true },
);

// 组件挂载时检查是否可以执行自动更新
onMounted(() => {
  // console.log('AutoUpdateChecker 组件已挂载');
  checkCanAutoUpdate();
});

// 组件卸载时清理监听器
onUnmounted(() => {
  // console.log('AutoUpdateChecker 组件已卸载，清理监听器');
  stopWatchAccess();
});
</script>

<template>
  <!-- 更新弹窗 -->
  <Modal
    v-model:open="isUpdateModalVisible"
    :title="`发现新版本 v${latestVersionInfo.version}`"
    centered
    width="90vw"
    @cancel="handleUpdateModalCancel"
  >
    <template #footer>
      <div
        v-if="!isDownloading"
        class="update-footer-actions"
        :class="{
          'update-footer-actions--dual': isVendorAppMarketUpdate,
        }"
      >
        <template v-if="isVendorAppMarketUpdate">
          <Button
            class="update-footer-button"
            type="primary"
            ghost
            @click="handleOpenAppMarket"
          >
            跳转应用商店
          </Button>
          <Button
            class="update-footer-button"
            :disabled="!canForceDownloadPackage"
            @click="handleForceDownloadPackage"
          >
            {{
              canForceDownloadPackage ? '仍然下载安装包' : '暂无安装包可下载'
            }}
          </Button>
        </template>
        <Button v-else type="primary" @click="handleUpdateModalOk">
          {{ updateOkText }}
        </Button>
      </div>
    </template>

    <!-- 更新说明 -->
    <div v-if="!isDownloading">
      <div v-if="isVendorAppMarketUpdate" class="huawei-update-tip">
        <div>
          检测到当前设备为华为/荣耀系，建议前往{{ appMarketName }}更新。
        </div>
        <div>商店中的版本可能会有延迟，请耐心等待。</div>
      </div>
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
</template>

<style scoped>
.update-footer-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.update-footer-actions--dual {
  justify-content: center;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
}

.update-footer-button {
  flex: 1 1 0;
  min-width: 0;
}

.huawei-update-tip {
  padding: 4px 0 0;
  margin-bottom: 16px;
  line-height: 1.6;
  color: #595959;
}

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

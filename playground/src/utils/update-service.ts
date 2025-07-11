import type { ProgressStatus } from '@capacitor/file-transfer';

import { ref } from 'vue';

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { FileTransfer } from '@capacitor/file-transfer';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { message } from 'ant-design-vue';
import semver from 'semver';

import { getLatestVersionApi } from '#/api/system';

// 更新状态管理
export const updateState = {
  downloadCancelled: ref(false),
  downloadProgress: ref(0),
  isDownloading: ref(false),
  isUpdateModalVisible: ref(false),
  latestVersionInfo: ref({
    notes: '',
    url: '',
    version: '',
  }),
};

/**
 * 发送本地推送通知（用于调试）
 */
export async function sendDebugNotification(title: string, body: string) {
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

/**
 * 检查应用更新
 * @param showLoading 是否显示加载提示
 * @param showSuccessMessage 是否显示"已是最新版本"的成功提示
 * @param autoInstall 检查到更新后是否自动安装（不显示确认弹窗）
 */
export async function checkAppUpdate(
  showLoading = true,
  showSuccessMessage = true,
  autoInstall = false,
): Promise<boolean> {
  // 只在原生平台执行检查
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  if (showLoading) {
    message.loading('正在检查更新...', 0);
  }

  try {
    const { version: currentVersion } = await App.getInfo();

    // 获取最新版本信息
    const {
      notes,
      url: updateUrl,
      version: latestVersion,
    } = await getLatestVersionApi();

    if (showLoading) {
      message.destroy();
    }

    // 版本比较
    if (semver.lt(currentVersion, latestVersion)) {
      updateState.latestVersionInfo.value = {
        notes,
        url: updateUrl,
        version: latestVersion,
      };

      if (autoInstall) {
        // 自动安装模式：直接开始下载安装
        await downloadAndInstallApk();
      } else {
        // 手动确认模式：显示更新弹窗
        updateState.isUpdateModalVisible.value = true;
      }
      return true;
    } else {
      if (showSuccessMessage) {
        message.success(`当前已是最新版本 (v${currentVersion})`);
      }
      return false;
    }
  } catch (error) {
    if (showLoading) {
      message.destroy();
    }
    const errorMessage =
      error instanceof Error ? error.message : '检查更新时发生错误';
    console.warn('检查更新失败:', errorMessage);

    // 自动检查模式下不显示错误提示，避免干扰用户
    if (showSuccessMessage) {
      message.error(errorMessage);
    }
    return false;
  }
}

/**
 * 下载并安装 APK
 */
export async function downloadAndInstallApk(): Promise<void> {
  if (!updateState.latestVersionInfo.value.url) {
    message.error('更新链接无效');
    return;
  }

  updateState.isDownloading.value = true;
  updateState.downloadProgress.value = 0;
  updateState.downloadCancelled.value = false;

  try {
    // 生成文件名
    const fileName = `app-update-${updateState.latestVersionInfo.value.version}.apk`;

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
          !updateState.downloadCancelled.value &&
          progress.lengthComputable &&
          progress.contentLength > 0
        ) {
          const percent = Math.round(
            (progress.bytes / progress.contentLength) * 100,
          );
          updateState.downloadProgress.value = percent;
        }
      },
    );

    try {
      // 下载 APK 文件到应用目录
      const downloadResult = await FileTransfer.downloadFile({
        path: fullPath,
        progress: true,
        url: updateState.latestVersionInfo.value.url,
      });

      console.warn('下载完成，文件路径:', downloadResult.path);
    } finally {
      // 移除进度监听器
      await progressListener.remove();
    }

    if (updateState.downloadCancelled.value) {
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
    updateState.isDownloading.value = false;
  }
}

/**
 * 取消下载
 */
export function cancelDownload(): void {
  updateState.downloadCancelled.value = true;
  updateState.isDownloading.value = false;
  updateState.downloadProgress.value = 0;
  message.info('下载已取消');
}

/**
 * 关闭更新弹窗
 */
export function closeUpdateModal(): void {
  if (updateState.isDownloading.value) {
    cancelDownload();
  }
  updateState.isUpdateModalVisible.value = false;
}

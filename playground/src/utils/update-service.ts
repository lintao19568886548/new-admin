import type { ProgressStatus } from '@capacitor/file-transfer';

import type { VersionInfo } from '#/api/system/version';

import { ref } from 'vue';

import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { FileTransfer } from '@capacitor/file-transfer';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { message } from 'ant-design-vue';
import semver from 'semver';

import { getLatestVersionApi } from '#/api/system';
import { normalizeIosStoreUrl } from '#/utils/app-update';

type UpdatePlatform = 'android' | 'ios';
type AndroidUpdateStrategy = 'app-market' | 'direct-download';
type AndroidVendorType = 'honor' | 'huawei' | 'other';

interface AndroidNativeBridge {
  getDeviceVendorInfo?: () => string;
  installApk?: (fileUri: string, fileName: string) => void;
  openAppMarket?: () => boolean;
}

interface AndroidVendorInfo {
  brand: string;
  isHuaweiFamily: boolean;
  manufacturer: string;
  vendorType: AndroidVendorType;
}

let androidVendorInfoCache: AndroidVendorInfo | null = null;

function getNativeUpdatePlatform(): null | UpdatePlatform {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  const platform = Capacitor.getPlatform();
  if (platform === 'android' || platform === 'ios') {
    return platform;
  }
  return null;
}

function isAndroidNativePlatform() {
  return getNativeUpdatePlatform() === 'android';
}

function isIosNativePlatform() {
  return getNativeUpdatePlatform() === 'ios';
}

function getAndroidInterface(): AndroidNativeBridge | null {
  if (!isAndroidNativePlatform()) {
    return null;
  }

  return (
    (window as Window & { AndroidInterface?: AndroidNativeBridge })
      .AndroidInterface || null
  );
}

function getDefaultAndroidVendorInfo(): AndroidVendorInfo {
  return {
    brand: '',
    isHuaweiFamily: false,
    manufacturer: '',
    vendorType: 'other',
  };
}

function parseAndroidVendorInfo(payload: string): AndroidVendorInfo {
  try {
    const parsed = JSON.parse(payload) as Partial<AndroidVendorInfo>;
    const vendorType =
      parsed.vendorType === 'honor' || parsed.vendorType === 'huawei'
        ? parsed.vendorType
        : 'other';

    return {
      brand: typeof parsed.brand === 'string' ? parsed.brand : '',
      isHuaweiFamily: !!parsed.isHuaweiFamily,
      manufacturer:
        typeof parsed.manufacturer === 'string' ? parsed.manufacturer : '',
      vendorType,
    };
  } catch (error) {
    console.warn('解析设备厂商信息失败:', error);
    return getDefaultAndroidVendorInfo();
  }
}

function getAndroidVendorInfo(): AndroidVendorInfo {
  if (!isAndroidNativePlatform()) {
    return getDefaultAndroidVendorInfo();
  }

  if (androidVendorInfoCache) {
    return androidVendorInfoCache;
  }

  const androidInterface = getAndroidInterface();
  if (!androidInterface?.getDeviceVendorInfo) {
    androidVendorInfoCache = getDefaultAndroidVendorInfo();
    return androidVendorInfoCache;
  }

  androidVendorInfoCache = parseAndroidVendorInfo(
    androidInterface.getDeviceVendorInfo(),
  );
  return androidVendorInfoCache;
}

function resolveAndroidUpdateStrategy(): AndroidUpdateStrategy {
  return getAndroidVendorInfo().isHuaweiFamily
    ? 'app-market'
    : 'direct-download';
}

function getAndroidAppMarketName(vendorType: AndroidVendorType): string {
  if (vendorType === 'honor') {
    return '荣耀应用市场';
  }

  if (vendorType === 'huawei') {
    return '华为应用市场';
  }

  return '应用商店';
}

function resolveUpdateUrl(versionInfo: VersionInfo, platform: UpdatePlatform) {
  if (platform === 'android') {
    return versionInfo.androidUrl || '';
  }

  // iOS 只接受 App Store 链接。
  if (versionInfo.iosUrl) {
    const iosUrl = normalizeIosStoreUrl(versionInfo.iosUrl);
    if (iosUrl) {
      return iosUrl;
    }
  }

  return '';
}

// 更新状态管理
export const updateState = {
  androidUpdateStrategy: ref<AndroidUpdateStrategy>('direct-download'),
  androidVendorType: ref<AndroidVendorType>('other'),
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
  const platform = getNativeUpdatePlatform();
  if (!platform) {
    return false;
  }

  if (showLoading) {
    message.loading('正在检查更新...', 0);
  }

  try {
    const { version: currentVersion } = await App.getInfo();

    // 获取最新版本信息
    const versionInfo = await getLatestVersionApi();
    const { notes, version: latestVersion } = versionInfo;
    const updateUrl = resolveUpdateUrl(versionInfo, platform);
    const androidVendorInfo =
      platform === 'android'
        ? getAndroidVendorInfo()
        : getDefaultAndroidVendorInfo();
    const androidUpdateStrategy =
      platform === 'android'
        ? resolveAndroidUpdateStrategy()
        : 'direct-download';

    if (showLoading) {
      message.destroy();
    }

    // 版本比较
    if (semver.lt(currentVersion, latestVersion)) {
      const requiresDirectUpdateUrl =
        platform === 'ios' ||
        (platform === 'android' && androidUpdateStrategy === 'direct-download');

      if (requiresDirectUpdateUrl && !updateUrl) {
        if (showSuccessMessage) {
          message.error('更新链接无效');
        }
        return false;
      }

      updateState.androidVendorType.value = androidVendorInfo.vendorType;
      updateState.androidUpdateStrategy.value = androidUpdateStrategy;
      updateState.latestVersionInfo.value = {
        notes,
        url: updateUrl,
        version: latestVersion,
      };

      const shouldShowHuaweiUpdateModal =
        platform === 'android' && androidUpdateStrategy === 'app-market';

      if (autoInstall && !shouldShowHuaweiUpdateModal) {
        // 自动安装模式：按平台执行更新动作
        await triggerAppUpdate();
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

export async function openAndroidAppMarketPage(): Promise<void> {
  if (!isAndroidNativePlatform()) {
    message.warning('当前平台不支持应用商店更新');
    return;
  }

  const androidInterface = getAndroidInterface();
  const appMarketName = getAndroidAppMarketName(
    updateState.androidVendorType.value,
  );

  if (!androidInterface?.openAppMarket) {
    message.warning(`当前设备无法打开${appMarketName}，请尝试下载安装包`);
    return;
  }

  try {
    const opened = androidInterface.openAppMarket();
    if (!opened) {
      message.warning(`未能打开${appMarketName}，请尝试下载安装包`);
      return;
    }

    updateState.isUpdateModalVisible.value = false;
  } catch (error) {
    console.error('打开应用商店失败:', error);
    message.error(`打开${appMarketName}失败，请稍后重试`);
  }
}

/**
 * 下载并安装 APK
 */
export async function downloadAndInstallApk(): Promise<void> {
  if (!isAndroidNativePlatform()) {
    message.warning('当前平台不支持 APK 安装');
    return;
  }

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
    let downloadUrl = '';

    try {
      downloadUrl = new URL(updateState.latestVersionInfo.value.url).toString();
    } catch {
      message.error('更新链接格式无效');
      return;
    }

    sendDebugNotification('开始下载', '正在下载 APK 安装包...');

    // 获取目标文件 URI，iOS/Android 均要求传入完整文件 URI
    const { uri: targetFileUri } = await Filesystem.getUri({
      directory: Directory.Data,
      path: fileName,
    });

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
        path: targetFileUri,
        progress: true,
        url: downloadUrl,
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
    const androidInterface = getAndroidInterface();
    if (androidInterface?.installApk) {
      try {
        androidInterface.installApk(fileUri.uri, fileName);
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

async function openIosUpdatePage(): Promise<void> {
  if (!isIosNativePlatform()) {
    message.warning('当前平台不支持 iOS 更新');
    return;
  }

  const updateUrl = updateState.latestVersionInfo.value.url;
  if (!updateUrl) {
    message.error('更新链接无效');
    return;
  }

  const normalizedUrl = normalizeIosStoreUrl(updateUrl);
  if (!normalizedUrl) {
    message.error('iOS 更新仅支持 App Store 链接');
    return;
  }

  try {
    if (normalizedUrl.startsWith('itms-apps://')) {
      window.location.assign(normalizedUrl);
    } else {
      await Browser.open({ url: normalizedUrl });
    }
    updateState.isUpdateModalVisible.value = false;
  } catch (error) {
    console.error('打开 iOS 更新页面失败:', error);
    message.error('打开更新页面失败，请稍后重试');
  }
}

/**
 * 触发更新动作（按平台执行不同策略）
 */
export async function triggerAppUpdate(): Promise<void> {
  if (isAndroidNativePlatform()) {
    if (updateState.androidUpdateStrategy.value === 'app-market') {
      await openAndroidAppMarketPage();
      return;
    }

    await downloadAndInstallApk();
    return;
  }

  if (isIosNativePlatform()) {
    await openIosUpdatePage();
    return;
  }

  message.warning('当前平台不支持应用更新');
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

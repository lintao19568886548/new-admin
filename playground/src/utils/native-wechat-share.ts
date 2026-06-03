import { Capacitor } from '@capacitor/core';

type NativeWechatScene = 'session' | 'timeline';

interface AndroidInterface {
  isWechatInstalled?: (appId: string) => boolean;
  shareWechatImage?: (payloadJson: string) => string;
  shareWechatWebpage?: (payloadJson: string) => string;
}

interface NativeWechatShareResponse {
  message?: string;
  ok: boolean;
  reason?: string;
}

export interface NativeWechatShareOptions {
  appId: string;
  description?: string;
  scene?: NativeWechatScene;
  thumbUrl?: string;
  title: string;
  url: string;
}

export interface NativeWechatImageShareOptions {
  appId: string;
  base64Data: string;
  scene?: NativeWechatScene;
}

declare global {
  interface Window {
    AndroidInterface?: AndroidInterface;
  }
}

function getAndroidInterface() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.AndroidInterface ?? null;
}

export function canUseNativeWechatShare() {
  return (
    Capacitor.getPlatform() === 'android' &&
    typeof getAndroidInterface()?.shareWechatWebpage === 'function'
  );
}

export function canUseNativeWechatImageShare() {
  return (
    Capacitor.getPlatform() === 'android' &&
    typeof getAndroidInterface()?.shareWechatImage === 'function'
  );
}

export function isWechatInstalled(appId: string) {
  if (
    !appId ||
    Capacitor.getPlatform() !== 'android' ||
    typeof getAndroidInterface()?.isWechatInstalled !== 'function'
  ) {
    return false;
  }

  try {
    return !!getAndroidInterface()?.isWechatInstalled?.(appId);
  } catch (error) {
    console.warn('检测微信安装状态失败:', error);
    return false;
  }
}

export async function shareWechatWebpage(
  options: NativeWechatShareOptions,
): Promise<NativeWechatShareResponse> {
  if (!options.appId) {
    return {
      message: '未配置微信开放平台移动应用 AppID',
      ok: false,
      reason: 'app-id-missing',
    };
  }

  if (!canUseNativeWechatShare()) {
    return {
      message: '当前设备不支持原生微信分享',
      ok: false,
      reason: 'unavailable',
    };
  }

  try {
    const rawResult = getAndroidInterface()?.shareWechatWebpage?.(
      JSON.stringify({
        appId: options.appId,
        description: options.description || '',
        scene: options.scene || 'session',
        thumbUrl: options.thumbUrl || '',
        title: options.title,
        url: options.url,
      }),
    );

    if (!rawResult) {
      return {
        message: '原生微信分享未返回结果',
        ok: false,
        reason: 'empty-result',
      };
    }

    const parsedResult = JSON.parse(
      rawResult,
    ) as Partial<NativeWechatShareResponse>;
    return {
      message: parsedResult.message,
      ok: parsedResult.ok === true,
      reason: parsedResult.reason,
    };
  } catch (error) {
    console.warn('调用原生微信分享失败:', error);
    return {
      message: error instanceof Error ? error.message : '调用原生微信分享失败',
      ok: false,
      reason: 'native-exception',
    };
  }
}

export async function shareWechatImage(
  options: NativeWechatImageShareOptions,
): Promise<NativeWechatShareResponse> {
  if (!options.appId) {
    return {
      message: '未配置微信开放平台移动应用 AppID',
      ok: false,
      reason: 'app-id-missing',
    };
  }

  if (!canUseNativeWechatImageShare()) {
    return {
      message: '当前设备不支持原生微信图片分享',
      ok: false,
      reason: 'unavailable',
    };
  }

  if (!options.base64Data) {
    return {
      message: '分享图片数据为空',
      ok: false,
      reason: 'image-data-empty',
    };
  }

  try {
    const rawResult = getAndroidInterface()?.shareWechatImage?.(
      JSON.stringify({
        appId: options.appId,
        base64Data: options.base64Data,
        scene: options.scene || 'session',
      }),
    );

    if (!rawResult) {
      return {
        message: '原生微信图片分享未返回结果',
        ok: false,
        reason: 'empty-result',
      };
    }

    const parsedResult = JSON.parse(
      rawResult,
    ) as Partial<NativeWechatShareResponse>;
    return {
      message: parsedResult.message,
      ok: parsedResult.ok === true,
      reason: parsedResult.reason,
    };
  } catch (error) {
    console.warn('调用原生微信图片分享失败:', error);
    return {
      message: error instanceof Error ? error.message : '调用微信图片分享失败',
      ok: false,
      reason: 'native-exception',
    };
  }
}

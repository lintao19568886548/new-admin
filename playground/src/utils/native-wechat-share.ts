import { Capacitor } from '@capacitor/core';

type NativeWechatScene = 'session' | 'timeline';

interface AndroidInterface {
  isWechatInstalled?: (appId: string) => boolean;
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

export function isWechatInstalled(appId: string) {
  if (!appId || !canUseNativeWechatShare()) {
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

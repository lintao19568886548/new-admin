import type { WechatJsSdkConfig } from '#/api/wechat';

import { readonly, shallowReactive } from 'vue';

export interface WechatJssdk {
  config: (config: Record<string, any>) => void;
  error: (callback: (error: unknown) => void) => void;
  miniProgram?: {
    postMessage?: (options: { data: Record<string, any> }) => void;
  };
  ready: (callback: () => void) => void;
  updateAppMessageShareData: (data: Record<string, any>) => void;
  updateTimelineShareData: (data: Record<string, any>) => void;
}

declare global {
  interface Window {
    __wxjs_environment?: string;
    wx?: WechatJssdk;
  }
}

export interface WechatJssdkInitResult {
  message?: string;
  ok: boolean;
  reason:
    | 'config-invalid'
    | 'ok'
    | 'sdk-unavailable'
    | 'wx-config-error'
    | 'wx-ready-timeout';
  wx?: WechatJssdk;
}

export interface WechatRuntimeState {
  isMiniProgram: boolean;
  isWechat: boolean;
  miniProgramEnvironment?: string;
}

interface InitWechatJssdkOptions {
  debug?: boolean;
  jsApiList?: string[];
  timeoutMs?: number;
}

const WECHAT_JSSDK_SCRIPT_ID = 'wechat-jssdk-script';
const WECHAT_JSSDK_URL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';

let wechatSdkPromise: null | Promise<null | WechatJssdk> = null;
const wechatRuntimeState = shallowReactive<WechatRuntimeState>({
  isMiniProgram: false,
  isWechat: false,
  miniProgramEnvironment: '',
});

export function isWechatBrowser() {
  return /MicroMessenger/i.test(navigator.userAgent);
}

export function isWechatMiniProgramWebView() {
  if (typeof window === 'undefined') {
    return false;
  }

  const environment = window.__wxjs_environment?.toLowerCase();
  if (environment === 'miniprogram') {
    return true;
  }

  return /\bminiprogram\b/i.test(navigator.userAgent);
}

function getCurrentMiniProgramEnvironment() {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.__wxjs_environment || '';
}

function getLiveWechatRuntimeState(): WechatRuntimeState {
  return {
    isMiniProgram: isWechatMiniProgramWebView(),
    isWechat: isWechatBrowser(),
    miniProgramEnvironment: getCurrentMiniProgramEnvironment(),
  };
}

function mergeWechatRuntimeState(state: WechatRuntimeState) {
  wechatRuntimeState.isMiniProgram =
    wechatRuntimeState.isMiniProgram || state.isMiniProgram;
  wechatRuntimeState.isWechat = wechatRuntimeState.isWechat || state.isWechat;
  wechatRuntimeState.miniProgramEnvironment =
    state.miniProgramEnvironment || wechatRuntimeState.miniProgramEnvironment;

  return {
    isMiniProgram: wechatRuntimeState.isMiniProgram,
    isWechat: wechatRuntimeState.isWechat,
    miniProgramEnvironment: wechatRuntimeState.miniProgramEnvironment || '',
  };
}

export function syncWechatRuntimeState() {
  const liveState = getLiveWechatRuntimeState();
  return mergeWechatRuntimeState(liveState);
}

export function getWechatRuntimeState() {
  return syncWechatRuntimeState();
}

export function useWechatRuntimeState() {
  return readonly(wechatRuntimeState);
}

export function bootstrapWechatRuntimeDetection(timeoutMs: number = 3000) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const initialState = syncWechatRuntimeState();
  if (!initialState.isWechat || initialState.isMiniProgram) {
    return () => {};
  }

  let intervalId = 0;
  let timeoutId = 0;

  const stop = () => {
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = 0;
    }
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = 0;
    }
    document.removeEventListener('WeixinJSBridgeReady', handleBridgeReady);
    window.removeEventListener('pageshow', handlePageShow);
  };

  const sync = () => {
    const nextState = syncWechatRuntimeState();
    if (nextState.isMiniProgram) {
      stop();
    }
  };

  const handleBridgeReady = () => {
    window.setTimeout(sync, 0);
    window.setTimeout(sync, 50);
    window.setTimeout(sync, 150);
  };

  const handlePageShow = () => {
    sync();
  };

  document.addEventListener('WeixinJSBridgeReady', handleBridgeReady);
  window.addEventListener('pageshow', handlePageShow);

  intervalId = window.setInterval(sync, 100);
  timeoutId = window.setTimeout(stop, timeoutMs);

  return stop;
}

export async function waitForWechatMiniProgramWebView(
  timeoutMs: number = 1500,
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  if (!isWechatBrowser()) {
    return false;
  }

  if (getWechatRuntimeState().isMiniProgram) {
    return true;
  }

  return await new Promise<boolean>((resolve) => {
    let settled = false;
    let intervalId = 0;
    let timeoutId = 0;

    const finish = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener('WeixinJSBridgeReady', handleBridgeReady);
      resolve(value);
    };

    const check = () => {
      const runtimeState = syncWechatRuntimeState();
      if (runtimeState.isMiniProgram) {
        finish(true);
      }
    };

    const handleBridgeReady = () => {
      window.setTimeout(check, 0);
      window.setTimeout(check, 50);
      window.setTimeout(check, 150);
    };

    document.addEventListener('WeixinJSBridgeReady', handleBridgeReady, {
      once: true,
    });

    intervalId = window.setInterval(check, 100);
    timeoutId = window.setTimeout(() => {
      const runtimeState = syncWechatRuntimeState();
      finish(runtimeState.isMiniProgram);
    }, timeoutMs);
  });
}

async function loadWechatJssdkScript() {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !isWechatBrowser()
  ) {
    return null;
  }

  if (window.wx) {
    return window.wx;
  }

  if (!wechatSdkPromise) {
    wechatSdkPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `#${WECHAT_JSSDK_SCRIPT_ID}`,
      );

      if (existingScript) {
        existingScript.addEventListener(
          'load',
          () => resolve(window.wx ?? null),
          { once: true },
        );
        existingScript.addEventListener('error', () =>
          reject(new Error('加载微信 JSSDK 失败')),
        );
        return;
      }

      const script = document.createElement('script');
      script.id = WECHAT_JSSDK_SCRIPT_ID;
      script.src = WECHAT_JSSDK_URL;
      script.async = true;
      script.addEventListener('load', () => resolve(window.wx ?? null), {
        once: true,
      });
      script.addEventListener(
        'error',
        () => reject(new Error('加载微信 JSSDK 失败')),
        { once: true },
      );
      document.head.append(script);
    });
  }

  return wechatSdkPromise;
}

export async function ensureWechatJsBridge() {
  return await loadWechatJssdkScript();
}

async function loadWechatJssdk() {
  if (isWechatMiniProgramWebView()) {
    return null;
  }

  return await loadWechatJssdkScript();
}

export async function initWechatJssdk(
  config: WechatJsSdkConfig,
  options: InitWechatJssdkOptions = {},
): Promise<WechatJssdkInitResult> {
  if (
    !config.enabled ||
    !config.appId ||
    !config.timestamp ||
    !config.nonceStr ||
    !config.signature
  ) {
    return {
      message: config.reason || '微信 JS-SDK 配置无效',
      ok: false,
      reason: 'config-invalid',
    };
  }

  let wx: null | WechatJssdk = null;
  try {
    wx = await loadWechatJssdk();
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : '加载微信 JSSDK 失败',
      ok: false,
      reason: 'sdk-unavailable',
    };
  }

  if (!wx) {
    return {
      message: '微信 JSSDK 未成功加载',
      ok: false,
      reason: 'sdk-unavailable',
    };
  }

  return await new Promise<WechatJssdkInitResult>((resolve) => {
    let settled = false;

    const finish = (result: WechatJssdkInitResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    wx.ready(() => {
      finish({
        ok: true,
        reason: 'ok',
        wx,
      });
    });

    wx.error((error) => {
      let errorMessage = '';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = JSON.stringify(error);
      }
      finish({
        message: errorMessage,
        ok: false,
        reason: 'wx-config-error',
      });
    });

    wx.config({
      appId: config.appId,
      debug: options.debug ?? false,
      jsApiList: options.jsApiList ?? [],
      nonceStr: config.nonceStr,
      signature: config.signature,
      timestamp: config.timestamp,
    });

    window.setTimeout(
      () =>
        finish({
          message: '等待 wx.ready 超时',
          ok: false,
          reason: 'wx-ready-timeout',
        }),
      options.timeoutMs ?? 4000,
    );
  });
}

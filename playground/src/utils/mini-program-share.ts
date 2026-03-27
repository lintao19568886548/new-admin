import type {
  MiniProgramShareContent,
  MiniProgramShareMessage,
} from './share-content';

import { buildMiniProgramShareMessage } from './share-content';
import { ensureWechatJsBridge } from './wechat-jssdk';

type WechatMiniProgramBridge = {
  miniProgram?: {
    postMessage?: (options: { data: MiniProgramShareMessage }) => void;
  };
};

function getCurrentWebPath() {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.pathname || '';
}

function getCurrentWebQuery() {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.search.replace(/^\?/, '');
}

function normalizeWebPath(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.includes('://') || normalizedValue.startsWith('//')) {
    return undefined;
  }

  return normalizedValue.startsWith('/')
    ? normalizedValue
    : `/${normalizedValue}`;
}

function normalizeWebQuery(
  value: MiniProgramShareContent['webQuery'],
): string | undefined {
  if (value === undefined) {
    return getCurrentWebQuery();
  }

  if (typeof value === 'string') {
    return value.replace(/^\?/, '');
  }

  const searchParams = new URLSearchParams();
  for (const [key, item] of Object.entries(value)) {
    searchParams.set(key, String(item));
  }
  return searchParams.toString();
}

async function getWechatMiniProgramBridge() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const currentBridge = window.wx as unknown as
    | undefined
    | WechatMiniProgramBridge;
  if (currentBridge?.miniProgram?.postMessage) {
    return currentBridge;
  }

  // 小程序 WebView 只需要 jweixin 提供的 bridge，不需要走 wx.config 签名初始化。
  const wxBridge = (await ensureWechatJsBridge()) as unknown as
    | undefined
    | WechatMiniProgramBridge;
  return wxBridge;
}

export async function syncMiniProgramShare(
  config: MiniProgramShareContent = {},
) {
  let wxBridge: undefined | WechatMiniProgramBridge;

  try {
    wxBridge = await getWechatMiniProgramBridge();
  } catch {
    return false;
  }

  if (!wxBridge?.miniProgram?.postMessage) {
    return false;
  }

  const payload: MiniProgramShareContent = {};

  const resolvedWebPath =
    config.webPath === undefined
      ? getCurrentWebPath()
      : normalizeWebPath(config.webPath);
  if (resolvedWebPath !== undefined) {
    payload.webPath = resolvedWebPath;
  }

  const resolvedWebQuery = normalizeWebQuery(config.webQuery);
  if (resolvedWebQuery !== undefined) {
    payload.webQuery = resolvedWebQuery;
  }

  wxBridge.miniProgram.postMessage({
    data: buildMiniProgramShareMessage(payload),
  });

  return true;
}

export async function clearMiniProgramShare() {
  return await syncMiniProgramShare({
    imageUrl: '',
    title: '',
    webPath: '',
    webQuery: '',
  });
}

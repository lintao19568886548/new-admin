import type { WechatPayAppConfig } from '#/api/wechat-pay';

import { getWechatPayAppConfig } from '#/api/wechat-pay';

let cachedWechatPayAppConfig: null | WechatPayAppConfig = null;
let loadingWechatPayAppConfig: null | Promise<WechatPayAppConfig> = null;

function normalizeWechatPayAppConfig(
  config: WechatPayAppConfig,
): WechatPayAppConfig {
  return {
    appId: String(config.appId || '').trim(),
    configured: config.configured === true,
    mchId: String(config.mchId || '').trim(),
    missing: Array.isArray(config.missing)
      ? config.missing.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
  };
}

export async function loadWechatPayAppConfig() {
  if (cachedWechatPayAppConfig) {
    return cachedWechatPayAppConfig;
  }

  if (!loadingWechatPayAppConfig) {
    loadingWechatPayAppConfig = getWechatPayAppConfig()
      .then((config) => {
        cachedWechatPayAppConfig = normalizeWechatPayAppConfig(config);
        return cachedWechatPayAppConfig;
      })
      .finally(() => {
        loadingWechatPayAppConfig = null;
      });
  }

  return loadingWechatPayAppConfig;
}

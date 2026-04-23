import type { WechatPayAppConfig } from '#/api/wechat-pay';

import { getWechatPayAppConfig } from '#/api/wechat-pay';

let cachedWechatPayAppConfig: null | WechatPayAppConfig = null;
let loadingWechatPayAppConfig: null | Promise<WechatPayAppConfig> = null;

function normalizeWechatPayAppConfig(
  config: WechatPayAppConfig,
): WechatPayAppConfig {
  return {
    appId: String(config.appId || '').trim(),
    mchId: String(config.mchId || '').trim(),
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

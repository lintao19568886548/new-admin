import type { AlipayPayAppConfig } from '#/api/alipay-pay';

import { getAlipayPayAppConfig } from '#/api/alipay-pay';

let cachedAlipayPayAppConfig: AlipayPayAppConfig | null = null;
let loadingAlipayPayAppConfig: null | Promise<AlipayPayAppConfig> = null;

function normalizeAlipayPayAppConfig(
  config: AlipayPayAppConfig,
): AlipayPayAppConfig {
  return {
    appId: String(config.appId || '').trim(),
    configured: config.configured === true,
    gatewayUrl: String(config.gatewayUrl || '').trim(),
    missing: Array.isArray(config.missing)
      ? config.missing.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
  };
}

export async function loadAlipayPayAppConfig() {
  if (cachedAlipayPayAppConfig) {
    return cachedAlipayPayAppConfig;
  }

  if (!loadingAlipayPayAppConfig) {
    loadingAlipayPayAppConfig = getAlipayPayAppConfig()
      .then((config) => {
        cachedAlipayPayAppConfig = normalizeAlipayPayAppConfig(config);
        return cachedAlipayPayAppConfig;
      })
      .finally(() => {
        loadingAlipayPayAppConfig = null;
      });
  }

  return loadingAlipayPayAppConfig;
}

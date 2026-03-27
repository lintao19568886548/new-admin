import { requestClient } from '#/api/request';

export interface WechatJsSdkConfig {
  appId?: string;
  enabled: boolean;
  nonceStr?: string;
  reason?: string;
  signature?: string;
  timestamp?: number;
}

export async function getWechatJsSdkConfig(
  url: string,
  options?: {
    debug?: boolean;
  },
) {
  return requestClient.get<WechatJsSdkConfig>('/wechat/js-sdk-config', {
    params: {
      debug: options?.debug ? '1' : undefined,
      url,
    },
  });
}

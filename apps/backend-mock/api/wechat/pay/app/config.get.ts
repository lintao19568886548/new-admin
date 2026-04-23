import { serverErrorResponse, useResponseSuccess } from '~/utils/response';
import { getWechatPayAppPublicConfig } from '~/utils/wechat-pay';

export default eventHandler((event) => {
  try {
    return useResponseSuccess(getWechatPayAppPublicConfig());
  } catch (error) {
    console.error('获取微信 APP 支付公开配置失败:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : '获取微信 APP 支付公开配置失败',
      event,
    );
  }
});

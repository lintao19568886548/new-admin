import type { WechatJssdk } from './wechat-jssdk';

export interface WechatH5ShareCardPayload {
  desc?: string;
  imgUrl: string;
  link: string;
  title: string;
}

export interface WechatH5ShareCardApplyResult {
  message?: string;
  ok: boolean;
  reason: 'ok' | 'update-share-data-failed';
}

export function applyWechatH5ShareCard(
  wx: WechatJssdk,
  payload: WechatH5ShareCardPayload,
): WechatH5ShareCardApplyResult {
  try {
    wx.updateAppMessageShareData(payload);
    wx.updateTimelineShareData({
      imgUrl: payload.imgUrl,
      link: payload.link,
      title: payload.title,
    });
    return {
      ok: true,
      reason: 'ok',
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : '设置微信分享数据失败',
      ok: false,
      reason: 'update-share-data-failed',
    };
  }
}

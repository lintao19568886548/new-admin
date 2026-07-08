package cn.yizuw.magic.backend.crm;

/**
 * CRM 销售二维码创建请求。
 *
 * <p>兼容旧 Nitro `/api/crm/sales/qrcode.post.ts`，迁移期只创建销售渠道和本地 PNG data URL，
 * 不调用微信小程序码接口。
 */
public record CrmSalesQrcodeRequest(
    Object channelName,
    Object channelType,
    Object envVersion,
    Boolean generateWxacode,
    Object page,
    Object qrCodeUrl,
    Object salesName,
    Object salesUserId,
    Object scene,
    Object weworkUserId,
    Integer width) {

  CrmSalesChannelCreateRequest toSalesChannelCreateRequest() {
    return new CrmSalesChannelCreateRequest(
        channelName, channelType, qrCodeUrl, salesName, salesUserId, scene, weworkUserId);
  }
}

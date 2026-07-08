package cn.yizuw.magic.backend.crm;

/** CRM 销售渠道新增请求；只写中心库 crm_sales_channel，不生成二维码或调用外部平台。 */
public record CrmSalesChannelCreateRequest(
    Object channelName,
    Object channelType,
    Object qrCodeUrl,
    Object salesName,
    Object salesUserId,
    Object scene,
    Object weworkUserId) {}

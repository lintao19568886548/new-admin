package cn.yizuw.magic.backend.crm;

/** CRM 销售渠道更新请求；限制在 crm_sales_channel 主表白名单字段内。 */
public record CrmSalesChannelUpdateRequest(
    Object channelName,
    Object channelType,
    Object id,
    Object qrCodeUrl,
    Object salesName,
    Object status,
    Object weworkUserId) {}

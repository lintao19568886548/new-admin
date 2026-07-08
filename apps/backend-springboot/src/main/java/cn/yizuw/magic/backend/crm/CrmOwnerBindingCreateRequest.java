package cn.yizuw.magic.backend.crm;

/** CRM 客户归属手工新增请求；只写中心库本地绑定表和扫码审计日志。 */
public record CrmOwnerBindingCreateRequest(
    Object customerName,
    Object externalUserId,
    Object firstChannelId,
    Object openid,
    Object ownerSalesUserId,
    Object phone,
    Object scene,
    Object unionid) {}

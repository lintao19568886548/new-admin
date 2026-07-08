package cn.yizuw.magic.backend.crm;

/** CRM 客户归属编辑请求；限制在客户身份和外部联系人字段内。 */
public record CrmOwnerBindingUpdateRequest(
    Object customerName,
    Object externalUserId,
    Object id,
    Object openid,
    Object phone,
    Object unionid) {}

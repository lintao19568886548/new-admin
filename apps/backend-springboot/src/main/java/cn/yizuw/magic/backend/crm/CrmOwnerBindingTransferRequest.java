package cn.yizuw.magic.backend.crm;

/** CRM 客户归属转移请求；仅变更本地归属销售和企微用户快照。 */
public record CrmOwnerBindingTransferRequest(
    Object id, Object reason, Object toSalesUserId, Object toWeworkUserId) {}

package cn.yizuw.magic.backend.crm;

/** CRM 客户归属绑定列表查询参数。 */
public record CrmOwnerBindingQuery(
    int currentPage,
    int pageSize,
    String keyword,
    String openid,
    String phone,
    Integer salesUserId,
    String scene,
    String unionid) {}

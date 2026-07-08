package cn.yizuw.magic.backend.crm;

/** CRM 扫码记录列表查询参数。 */
public record CrmScanLogQuery(
    int currentPage,
    String keyword,
    String openid,
    int pageSize,
    String phone,
    Integer salesUserId,
    String scene,
    String unionid) {}

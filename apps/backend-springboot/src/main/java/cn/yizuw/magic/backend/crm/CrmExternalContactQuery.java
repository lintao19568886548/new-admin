package cn.yizuw.magic.backend.crm;

/** CRM 企微外部联系人回调日志查询参数。 */
public record CrmExternalContactQuery(
    Integer bindingId,
    String changeType,
    int currentPage,
    String externalUserId,
    String keyword,
    int pageSize,
    Integer salesUserId,
    String state,
    String weworkUserId) {}

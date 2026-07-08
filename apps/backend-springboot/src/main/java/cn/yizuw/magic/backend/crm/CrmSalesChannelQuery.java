package cn.yizuw.magic.backend.crm;

/** CRM 销售获客渠道列表查询参数。 */
public record CrmSalesChannelQuery(
    int currentPage, int pageSize, Integer salesUserId, String scene, String status) {}

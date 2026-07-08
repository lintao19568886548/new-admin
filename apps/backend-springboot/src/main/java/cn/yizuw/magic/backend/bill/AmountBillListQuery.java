package cn.yizuw.magic.backend.bill;

/** 总账单列表查询参数，兼容旧 Nitro `/bill/amount/list`。 */
public record AmountBillListQuery(
    String collectionStatus,
    Integer currentPage,
    Integer currentPark,
    String endTime,
    Integer pageSize,
    String projectEndDate,
    String projectName,
    String projectStartDate,
    String startTime,
    String tenantName) {}

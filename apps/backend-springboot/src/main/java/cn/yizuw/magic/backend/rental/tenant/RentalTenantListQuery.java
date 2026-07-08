package cn.yizuw.magic.backend.rental.tenant;

/** 租户列表查询参数，字段名保持旧 Nitro 接口和前端筛选项兼容。 */
public record RentalTenantListQuery(
    Integer currentPage,
    Integer currentPark,
    String address,
    String contractDate,
    String contractEnd,
    String contractStart,
    String contractView,
    String date,
    String increaseDate,
    String increaseRate,
    Integer pageSize,
    Integer parkId,
    String phoneNumber,
    String status,
    String tenantName,
    String transactionType) {}

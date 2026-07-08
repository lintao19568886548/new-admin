package cn.yizuw.magic.backend.rental.tenant;

/** 工资列表查询参数，兼容旧接口 currentPark、issueDate、issued 等筛选项。 */
public record SalaryListQuery(
    Integer currentPage,
    Integer currentPark,
    Boolean issued,
    String issueDate,
    Integer pageSize,
    Integer parkId,
    String phoneNumber,
    String salaryAmount,
    String tenantName) {}

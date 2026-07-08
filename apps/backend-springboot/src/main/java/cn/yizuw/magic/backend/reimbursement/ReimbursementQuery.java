package cn.yizuw.magic.backend.reimbursement;

/** 报销列表、汇总和分析接口共用查询参数。 */
public record ReimbursementQuery(
    String claimant,
    String department,
    String endDate,
    Integer pageNo,
    Integer pageSize,
    String payee,
    Integer parkId,
    String purpose,
    String startDate,
    Integer status) {}

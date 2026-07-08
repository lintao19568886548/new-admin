package cn.yizuw.magic.backend.rental.tenant;

import java.math.BigDecimal;

/** 工资记录更新请求；第四十三批只写 salary 主表白名单字段，图片关系后续专项迁移。 */
public record SalaryUpdateRequest(
    String issueDate,
    Object issued,
    String remark,
    Object rentalTenantId,
    BigDecimal salaryAmount) {}

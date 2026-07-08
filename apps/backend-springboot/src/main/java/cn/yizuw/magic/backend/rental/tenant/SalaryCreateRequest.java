package cn.yizuw.magic.backend.rental.tenant;

import java.math.BigDecimal;

/**
 * 工资记录新增请求。
 *
 * <p>第 60 批只写 salary 主表白名单字段；images 字段仅为兼容旧入参保留，工资图片关系留给后续专项迁移。
 */
public record SalaryCreateRequest(
    String issueDate,
    Object images,
    Object issued,
    String remark,
    Object rentalTenantId,
    BigDecimal salaryAmount) {}

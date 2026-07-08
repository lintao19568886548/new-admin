package cn.yizuw.magic.backend.finance;

import java.math.BigDecimal;

/**
 * 财务流水新增请求。
 *
 * <p>第 60 批只创建 finance 主表记录；images 字段仅为兼容旧前端入参保留，本批不写
 * finance_image 关系，也不触发租赁费用同步。
 */
public record FinanceCreateRequest(
    BigDecimal amount,
    String billCategory,
    String billName,
    Object images,
    Object parkId,
    String remark,
    String transactionTime,
    String transactionType) {}

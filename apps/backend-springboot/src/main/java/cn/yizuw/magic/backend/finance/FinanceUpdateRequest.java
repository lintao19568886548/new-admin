package cn.yizuw.magic.backend.finance;

import java.math.BigDecimal;

/** 财务流水更新请求；第四十三批只允许更新 finance 主表字段，不重建图片关系。 */
public record FinanceUpdateRequest(
    BigDecimal amount,
    String billCategory,
    String billName,
    Object parkId,
    String remark,
    Object status,
    String transactionTime,
    String transactionType) {}

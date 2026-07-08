package cn.yizuw.magic.backend.finance;

/**
 * 财务列表查询条件。
 *
 * <p>字段名保持和旧 Nitro 接口一致，便于迁移期网关按路径逐步切流。
 */
public record FinanceQuery(
    String amount,
    String billCategory,
    String billName,
    Integer currentPage,
    String endTime,
    Integer pageSize,
    Integer parkId,
    String startTime,
    Integer status,
    String transactionType) {}

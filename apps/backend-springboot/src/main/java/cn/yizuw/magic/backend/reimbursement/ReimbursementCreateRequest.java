package cn.yizuw.magic.backend.reimbursement;

import java.math.BigDecimal;

/**
 * 报销申请新增请求。
 *
 * <p>第 62 批只写 {@code reimbursement} 主表；旧接口中的图片关系写入和审核通过后的财务同步不在本批范围内。
 */
public record ReimbursementCreateRequest(
    BigDecimal amount,
    String claimant,
    String date,
    String department,
    Object images,
    String payee,
    Object parkId,
    String purpose,
    String remark,
    Integer status,
    String username) {}

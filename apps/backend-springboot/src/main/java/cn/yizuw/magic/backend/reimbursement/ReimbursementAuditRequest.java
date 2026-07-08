package cn.yizuw.magic.backend.reimbursement;

/**
 * 报销审核请求。
 *
 * <p>第 65 批只更新 reimbursement 主表的审核状态和审核意见；审核通过后的 finance 同步留给后续专项批次。
 */
public record ReimbursementAuditRequest(Object status, String auditOpinion) {}

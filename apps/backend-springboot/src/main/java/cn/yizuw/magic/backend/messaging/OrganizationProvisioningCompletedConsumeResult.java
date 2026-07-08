package cn.yizuw.magic.backend.messaging;

/** 组织空间开通完成事件消费结果；当前批次只做幂等落表，不触发通知或缓存刷新。 */
public record OrganizationProvisioningCompletedConsumeResult(
    boolean consumed,
    String customerId,
    boolean duplicate,
    String eventId,
    String eventType,
    boolean followupTaskQueued,
    String followupTaskMessageId,
    String idempotencyKey,
    Integer jobId,
    String reason,
    String status,
    String targetCustomerId,
    String targetDbName) {}

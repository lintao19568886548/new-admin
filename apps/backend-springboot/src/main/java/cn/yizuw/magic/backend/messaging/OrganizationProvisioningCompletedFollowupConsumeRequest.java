package cn.yizuw.magic.backend.messaging;

/** RabbitMQ 组织开通完成 followup 轻任务消费请求。 */
public record OrganizationProvisioningCompletedFollowupConsumeRequest(
    String eventId,
    String idempotencyKey,
    String messageId,
    String payload,
    String taskType) {}

package cn.yizuw.magic.backend.messaging;

/** RabbitMQ 组织开通完成 notification 消费请求。 */
public record OrganizationProvisioningCompletedNotificationConsumeRequest(
    String eventId,
    String idempotencyKey,
    String messageId,
    String payload,
    String eventType,
    String templateKey) {}

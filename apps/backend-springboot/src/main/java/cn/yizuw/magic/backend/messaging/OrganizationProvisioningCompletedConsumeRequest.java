package cn.yizuw.magic.backend.messaging;

/** 组织空间开通完成事件消费请求；由 Kafka listener 从消息头和消息体组装。 */
public record OrganizationProvisioningCompletedConsumeRequest(
    String consumerGroup,
    String customerId,
    String eventId,
    String eventType,
    String idempotencyKey,
    String payload,
    String topic) {}

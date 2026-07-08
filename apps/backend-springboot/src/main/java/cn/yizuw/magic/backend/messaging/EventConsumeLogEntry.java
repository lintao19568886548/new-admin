package cn.yizuw.magic.backend.messaging;

/** Kafka 消费幂等日志写入参数；对应中心库 event_consume_log 表。 */
public record EventConsumeLogEntry(
    String consumerGroup,
    String eventId,
    String eventType,
    String idempotencyKey,
    String topic) {}

package cn.yizuw.magic.backend.messaging;

import java.time.OffsetDateTime;

public record OutboxEvent(
    Long id,
    String aggregateId,
    String aggregateType,
    Integer attempts,
    OffsetDateTime createdAt,
    String customerId,
    String eventId,
    String eventType,
    String idempotencyKey,
    OffsetDateTime nextAttemptAt,
    String payload,
    String status,
    String topic,
    OffsetDateTime updatedAt) {}

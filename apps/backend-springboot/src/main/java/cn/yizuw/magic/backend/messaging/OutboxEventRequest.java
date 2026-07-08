package cn.yizuw.magic.backend.messaging;

import jakarta.validation.constraints.NotBlank;

public record OutboxEventRequest(
    String aggregateId,
    String aggregateType,
    @NotBlank String customerId,
    @NotBlank String eventType,
    @NotBlank String idempotencyKey,
    @NotBlank String payload,
    @NotBlank String topic) {}

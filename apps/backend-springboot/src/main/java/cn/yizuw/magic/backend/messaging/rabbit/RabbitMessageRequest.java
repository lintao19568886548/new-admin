package cn.yizuw.magic.backend.messaging.rabbit;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record RabbitMessageRequest(
    String aggregateId,
    String aggregateType,
    @NotBlank String customerId,
    Map<String, Object> headers,
    String idempotencyKey,
    String messageId,
    @NotBlank String payload,
    String routingKey) {}

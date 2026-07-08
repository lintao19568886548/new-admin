package cn.yizuw.magic.backend.messaging.rabbit;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import cn.yizuw.magic.backend.config.AppProperties;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageBuilderSupport;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class RabbitMessagePublisher {

  private static final Logger LOGGER = LoggerFactory.getLogger(RabbitMessagePublisher.class);

  private final RabbitTemplate rabbitTemplate;
  private final AppProperties appProperties;

  public RabbitMessagePublisher(RabbitTemplate rabbitTemplate, AppProperties appProperties) {
    this.rabbitTemplate = rabbitTemplate;
    this.appProperties = appProperties;
  }

  public String publishLightTask(RabbitMessageRequest request) {
    String routingKey = defaultRoutingKey(request.routingKey(), RabbitMqTopology.ROUTING_LIGHT_TASK);
    return publish(RabbitMqTopology.EXCHANGE_LIGHT_TASK, routingKey, request);
  }

  public String publishNotification(RabbitMessageRequest request) {
    String routingKey = defaultRoutingKey(request.routingKey(), RabbitMqTopology.ROUTING_NOTIFICATION);
    return publish(RabbitMqTopology.EXCHANGE_NOTIFICATION, routingKey, request);
  }

  public String publishNotificationRetry(RabbitMessageRequest request) {
    return publish(
        RabbitMqTopology.EXCHANGE_NOTIFICATION,
        RabbitMqTopology.ROUTING_NOTIFICATION_RETRY,
        request);
  }

  public String publishDelayedRetry(RabbitMessageRequest request) {
    return publish(RabbitMqTopology.EXCHANGE_DELAY, RabbitMqTopology.ROUTING_DELAY_RETRY, request);
  }

  private String publish(String exchange, String routingKey, RabbitMessageRequest request) {
    assertPublishAllowed(exchange, request.routingKey());
    String messageId =
        StringUtils.hasText(request.messageId()) ? request.messageId() : UUID.randomUUID().toString();
    String idempotencyKey =
        StringUtils.hasText(request.idempotencyKey()) ? request.idempotencyKey() : messageId;

    MessageBuilderSupport<Message> builder =
        MessageBuilder.withBody(request.payload().getBytes(StandardCharsets.UTF_8))
            .setContentType("application/json")
            .setDeliveryMode(MessageDeliveryMode.PERSISTENT)
            .setMessageId(messageId)
            .setHeader("aggregateId", nullToEmpty(request.aggregateId()))
            .setHeader("aggregateType", nullToEmpty(request.aggregateType()))
            .setHeader("customerId", request.customerId())
            .setHeader("idempotencyKey", idempotencyKey)
            .setHeader("occurredAt", Instant.now().toString());

    if (request.headers() != null) {
      for (Map.Entry<String, Object> entry : request.headers().entrySet()) {
        builder.setHeader(entry.getKey(), entry.getValue());
      }
    }

    Message message = builder.build();
    rabbitTemplate.send(exchange, routingKey, message);
    return messageId;
  }

  private void assertPublishAllowed(String exchange, String routingKey) {
    if (!appProperties.getRabbitMq().isEnabled()) {
      LOGGER.warn("RabbitMQ publish blocked: app.rabbit-mq.enabled=false (exchange={})", exchange);
      throw new IllegalStateException("RabbitMQ is disabled");
    }
    if (RabbitMqTopology.EXCHANGE_NOTIFICATION.equals(exchange)
        && !appProperties.getRabbitMq().isNotificationPublishEnabled()) {
      LOGGER.warn(
          "RabbitMQ notification publish blocked: app.rabbit-mq.notification-publish-enabled=false, routingKey={}",
          routingKey);
      throw new IllegalStateException("RabbitMQ notification publish is disabled");
    }
  }

  private String defaultRoutingKey(String routingKey, String fallback) {
    return StringUtils.hasText(routingKey) ? routingKey : fallback;
  }

  private String nullToEmpty(String value) {
    return value == null ? "" : value;
  }
}

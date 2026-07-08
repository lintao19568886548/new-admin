package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.messaging.rabbit.RabbitMqTopology;
import java.nio.charset.StandardCharsets;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** RabbitMQ notification 消费入口；独立开关保护，避免误消费共享通知队列。 */
@Component
@ConditionalOnProperty(
    prefix = "app.rabbit-mq",
    name = "consumer-enabled",
    havingValue = "true")
@ConditionalOnProperty(
    prefix = "app.rabbit-mq",
    name = "organization-provisioning-notification-consumer-enabled",
    havingValue = "true")
@ConditionalOnProperty(
    prefix = "app.rabbit-mq",
    name = "notification-routing-consumer-enabled",
    havingValue = "false",
    matchIfMissing = true)
public class OrganizationProvisioningCompletedNotificationRabbitListener {

  private final OrganizationProvisioningCompletedNotificationConsumerService consumerService;

  public OrganizationProvisioningCompletedNotificationRabbitListener(
      OrganizationProvisioningCompletedNotificationConsumerService consumerService) {
    this.consumerService = consumerService;
  }

  /**
   * 监听通知主队列。
   *
   * <p>`magic.notification.queue` 是共享队列；本 listener 只允许灰度消费组织开通完成通知，
   * 其它通知消息必须保留给后续通用 notification consumer。
   */
  @RabbitListener(queues = RabbitMqTopology.QUEUE_NOTIFICATION)
  public void onMessage(Message message) {
    MessageProperties properties = message.getMessageProperties();
    String eventType = header(properties, "eventType");
    String templateKey = header(properties, "templateKey");
    if (!OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE.equals(eventType)
        || !OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY.equals(
            templateKey)) {
      throw new IllegalArgumentException("共享通知队列收到非组织开通完成通知消息");
    }
    consumerService.consume(
        new OrganizationProvisioningCompletedNotificationConsumeRequest(
            header(properties, "eventId"),
            header(properties, "idempotencyKey"),
            properties.getMessageId(),
            new String(message.getBody(), StandardCharsets.UTF_8),
            eventType,
            templateKey));
  }

  private String header(MessageProperties properties, String name) {
    Object value = properties.getHeaders().get(name);
    return value == null ? null : String.valueOf(value);
  }
}

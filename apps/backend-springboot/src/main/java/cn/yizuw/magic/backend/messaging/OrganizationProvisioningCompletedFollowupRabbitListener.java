package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.messaging.rabbit.RabbitMqTopology;
import java.nio.charset.StandardCharsets;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** RabbitMQ light-task 消费入口；默认关闭，本批只识别组织开通完成 followup。 */
@Component
@ConditionalOnProperty(prefix = "app.rabbit-mq", name = "consumer-enabled", havingValue = "true")
public class OrganizationProvisioningCompletedFollowupRabbitListener {

  private final OrganizationProvisioningCompletedFollowupConsumerService consumerService;

  public OrganizationProvisioningCompletedFollowupRabbitListener(
      OrganizationProvisioningCompletedFollowupConsumerService consumerService) {
    this.consumerService = consumerService;
  }

  /**
   * 监听轻任务队列。
   *
   * <p>当前只处理组织空间开通完成 followup，其它轻任务继续留给后续专项 listener。
   */
  @RabbitListener(queues = RabbitMqTopology.QUEUE_LIGHT_TASK)
  public void onMessage(Message message) {
    MessageProperties properties = message.getMessageProperties();
    String taskType = header(properties, "taskType");
    if (!OrganizationProvisioningCompletedFollowupPublisher.TASK_TYPE.equals(taskType)) {
      return;
    }
    consumerService.consume(
        new OrganizationProvisioningCompletedFollowupConsumeRequest(
            header(properties, "eventId"),
            header(properties, "idempotencyKey"),
            properties.getMessageId(),
            new String(message.getBody(), StandardCharsets.UTF_8),
            taskType));
  }

  private String header(MessageProperties properties, String name) {
    Object value = properties.getHeaders().get(name);
    return value == null ? null : String.valueOf(value);
  }
}

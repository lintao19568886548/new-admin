package cn.yizuw.magic.backend.messaging;

import java.nio.charset.StandardCharsets;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Header;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** 组织空间开通 Kafka 消费入口；默认关闭，打开后仅消费 completed 事件。 */
@Component
@ConditionalOnProperty(prefix = "app.kafka", name = "consumer-enabled", havingValue = "true")
public class OrganizationProvisioningCompletedKafkaListener {

  private final String consumerGroup;
  private final OrganizationProvisioningCompletedConsumerService consumerService;

  public OrganizationProvisioningCompletedKafkaListener(
      @Value("${spring.kafka.consumer.group-id:backend-springboot}") String consumerGroup,
      OrganizationProvisioningCompletedConsumerService consumerService) {
    this.consumerGroup = consumerGroup;
    this.consumerService = consumerService;
  }

  /**
   * 监听组织空间开通主题。
   *
   * <p>本批只把 completed 事件交给幂等消费服务；其它组织事件留给后续批次单独处理。
   */
  @KafkaListener(topics = OrganizationProvisioningCompletedConsumerService.TOPIC)
  public void onMessage(ConsumerRecord<String, String> record) {
    String eventType = header(record, "eventType");
    if (!OrganizationProvisioningCompletedConsumerService.EVENT_TYPE.equals(eventType)) {
      return;
    }
    consumerService.consume(
        new OrganizationProvisioningCompletedConsumeRequest(
            consumerGroup,
            header(record, "customerId"),
            header(record, "eventId"),
            eventType,
            header(record, "idempotencyKey"),
            record.value(),
            record.topic()));
  }

  private String header(ConsumerRecord<String, String> record, String name) {
    Header header = record.headers().lastHeader(name);
    if (header == null || header.value() == null) {
      return null;
    }
    return new String(header.value(), StandardCharsets.UTF_8);
  }
}

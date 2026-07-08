package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessagePublisher;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessageRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** 组织开通完成通知投递器；只投递 RabbitMQ notification 队列，不调用短信/企微 provider。 */
@Service
public class OrganizationProvisioningCompletedNotificationPublisher {

  private static final ObjectMapper JSON = new ObjectMapper();

  private final RabbitMessagePublisher rabbitMessagePublisher;

  public OrganizationProvisioningCompletedNotificationPublisher(
      RabbitMessagePublisher rabbitMessagePublisher) {
    this.rabbitMessagePublisher = rabbitMessagePublisher;
  }

  /**
   * 根据通知计划中的 `rabbitMessagePreview` 投递 notification 队列。
   *
   * <p>真实收件人解析和短信/企微/站内通知 provider 调用继续留给 notification consumer 后续批次。
   */
  public String publish(Map<String, Object> notificationPlan) {
    Map<String, Object> preview = mapValue(notificationPlan.get("rabbitMessagePreview"));
    Map<String, Object> payload = mapValue(preview.get("payload"));
    return rabbitMessagePublisher.publishNotification(
        new RabbitMessageRequest(
            string(preview.get("aggregateId")),
            string(preview.get("aggregateType")),
            string(preview.get("customerId")),
            mapValue(preview.get("headers")),
            string(preview.get("idempotencyKey")),
            string(preview.get("messageId")),
            toJson(payload),
            string(preview.get("routingKey"))));
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> mapValue(Object value) {
    if (value instanceof Map<?, ?> map) {
      return (Map<String, Object>) map;
    }
    throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "组织开通通知消息预览缺失");
  }

  private String string(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String toJson(Map<String, Object> payload) {
    try {
      return JSON.writeValueAsString(payload);
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "组织开通通知消息序列化失败");
    }
  }
}

package cn.yizuw.magic.backend.messaging.rabbit;

import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.ApiResponse;
import org.springframework.http.HttpStatus;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RabbitMessageController {

  private final RabbitMessagePublisher rabbitMessagePublisher;
  private final AppProperties appProperties;

  public RabbitMessageController(
      RabbitMessagePublisher rabbitMessagePublisher, AppProperties appProperties) {
    this.rabbitMessagePublisher = rabbitMessagePublisher;
    this.appProperties = appProperties;
  }

  @PostMapping("/internal/rabbit/light-tasks")
  public ApiResponse<Map<String, String>> publishLightTask(
      @Valid @RequestBody RabbitMessageRequest request) {
    ensureRabbitEnabled();
    return ApiResponse.ok(Map.of("messageId", rabbitMessagePublisher.publishLightTask(request)));
  }

  @PostMapping("/internal/rabbit/notifications")
  public ApiResponse<Map<String, String>> publishNotification(
      @Valid @RequestBody RabbitMessageRequest request) {
    ensureNotificationPublishEnabled();
    return ApiResponse.ok(Map.of("messageId", rabbitMessagePublisher.publishNotification(request)));
  }

  @PostMapping("/internal/rabbit/notifications/retry")
  public ApiResponse<Map<String, String>> publishNotificationRetry(
      @Valid @RequestBody RabbitMessageRequest request) {
    ensureNotificationPublishEnabled();
    return ApiResponse.ok(Map.of("messageId", rabbitMessagePublisher.publishNotificationRetry(request)));
  }

  @PostMapping("/internal/rabbit/delayed-retries")
  public ApiResponse<Map<String, String>> publishDelayedRetry(
      @Valid @RequestBody RabbitMessageRequest request) {
    ensureRabbitEnabled();
    return ApiResponse.ok(Map.of("messageId", rabbitMessagePublisher.publishDelayedRetry(request)));
  }

  private void ensureRabbitEnabled() {
    if (!appProperties.getRabbitMq().isEnabled()) {
      throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "RabbitMQ 已禁用");
    }
  }

  private void ensureNotificationPublishEnabled() {
    ensureRabbitEnabled();
    if (!appProperties.getRabbitMq().isNotificationPublishEnabled()) {
      throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "通知消息发布未开启");
    }
  }
}

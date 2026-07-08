package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessagePublisher;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessageRequest;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMqTopology;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** 组织开通完成通知投递测试；只验证 RabbitMQ notification 消息封装。 */
class OrganizationProvisioningCompletedNotificationPublisherTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  @Test
  void publishQueuesNotificationMessageFromPreview() throws Exception {
    RabbitMessagePublisher rabbitMessagePublisher =
        org.mockito.Mockito.mock(RabbitMessagePublisher.class);
    when(rabbitMessagePublisher.publishNotification(org.mockito.ArgumentMatchers.any()))
        .thenReturn("msg_notification_31");
    OrganizationProvisioningCompletedNotificationPublisher publisher =
        new OrganizationProvisioningCompletedNotificationPublisher(rabbitMessagePublisher);

    String messageId = publisher.publish(notificationPlan());

    assertThat(messageId).isEqualTo("msg_notification_31");
    ArgumentCaptor<RabbitMessageRequest> captor =
        ArgumentCaptor.forClass(RabbitMessageRequest.class);
    verify(rabbitMessagePublisher).publishNotification(captor.capture());
    RabbitMessageRequest request = captor.getValue();
    assertThat(request.aggregateId()).isEqualTo("31");
    assertThat(request.aggregateType()).isEqualTo("tenant_provisioning_job");
    assertThat(request.customerId()).isEqualTo("org001");
    assertThat(request.idempotencyKey())
        .isEqualTo("organization-provisioning-completed-notification:31");
    assertThat(request.messageId()).isEqualTo("organization-provisioning-completed-notification-31");
    assertThat(request.routingKey()).isEqualTo(RabbitMqTopology.ROUTING_NOTIFICATION);
    assertThat(request.headers())
        .containsEntry("eventType", OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE)
        .containsEntry("templateKey", OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);

    Map<String, Object> payload =
        JSON.readValue(request.payload(), new TypeReference<Map<String, Object>>() {});
    assertThat(payload)
        .containsEntry("jobId", 31)
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001")
        .containsEntry("providerCallEnabled", false);
  }

  private Map<String, Object> notificationPlan() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("jobId", 31);
    payload.put("targetCustomerId", "org001");
    payload.put("targetDbName", "tenant_org001");
    payload.put("providerCallEnabled", false);

    Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("aggregateId", "31");
    preview.put("aggregateType", "tenant_provisioning_job");
    preview.put("customerId", "org001");
    preview.put(
        "headers",
        Map.of(
            "eventType",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            "templateKey",
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY));
    preview.put("idempotencyKey", "organization-provisioning-completed-notification:31");
    preview.put("messageId", "organization-provisioning-completed-notification-31");
    preview.put("payload", payload);
    preview.put("routingKey", RabbitMqTopology.ROUTING_NOTIFICATION);

    return Map.of("rabbitMessagePreview", preview);
  }
}

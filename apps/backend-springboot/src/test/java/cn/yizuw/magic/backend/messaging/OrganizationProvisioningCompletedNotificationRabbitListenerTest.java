package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;

/** RabbitMQ notification listener 测试；确认共享队列只允许组织开通完成消息。 */
class OrganizationProvisioningCompletedNotificationRabbitListenerTest {

  private OrganizationProvisioningCompletedNotificationConsumerService consumerService;
  private OrganizationProvisioningCompletedNotificationRabbitListener listener;

  @BeforeEach
  void setUp() {
    consumerService =
        org.mockito.Mockito.mock(OrganizationProvisioningCompletedNotificationConsumerService.class);
    listener = new OrganizationProvisioningCompletedNotificationRabbitListener(consumerService);
  }

  @Test
  void onMessageDelegatesOrganizationProvisioningNotification() {
    Message message =
        message(
            "{\"jobId\":31}",
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);

    listener.onMessage(message);

    ArgumentCaptor<OrganizationProvisioningCompletedNotificationConsumeRequest> captor =
        ArgumentCaptor.forClass(OrganizationProvisioningCompletedNotificationConsumeRequest.class);
    verify(consumerService).consume(captor.capture());
    OrganizationProvisioningCompletedNotificationConsumeRequest request = captor.getValue();
    assertThat(request.eventId()).isEqualTo("evt_notification_31");
    assertThat(request.idempotencyKey())
        .isEqualTo("organization-provisioning-completed-notification:31");
    assertThat(request.messageId()).isEqualTo("msg_notification_31");
    assertThat(request.payload()).isEqualTo("{\"jobId\":31}");
    assertThat(request.eventType())
        .isEqualTo(OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE);
    assertThat(request.templateKey())
        .isEqualTo(OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
  }

  @Test
  void onMessageRejectsOtherNotificationTypesWithoutConsumingThem() {
    Message message =
        message(
            "{}",
            "msg_sms",
            "evt_sms",
            "contract-reminder-sms:1",
            "contract_reminder_sms",
            "contract_reminder_sms");

    assertThatThrownBy(() -> listener.onMessage(message))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("共享通知队列收到非组织开通完成通知消息");
    verify(consumerService, never()).consume(org.mockito.ArgumentMatchers.any());
  }

  private Message message(
      String payload,
      String messageId,
      String eventId,
      String idempotencyKey,
      String eventType,
      String templateKey) {
    MessageProperties properties = new MessageProperties();
    properties.setMessageId(messageId);
    properties.setHeader("eventId", eventId);
    properties.setHeader("idempotencyKey", idempotencyKey);
    properties.setHeader("eventType", eventType);
    properties.setHeader("templateKey", templateKey);
    return new Message(payload.getBytes(StandardCharsets.UTF_8), properties);
  }
}

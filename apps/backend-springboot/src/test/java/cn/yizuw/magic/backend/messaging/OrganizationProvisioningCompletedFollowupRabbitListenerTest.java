package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;

/** RabbitMQ followup listener 测试；只验证 light-task 过滤和请求组装。 */
class OrganizationProvisioningCompletedFollowupRabbitListenerTest {

  private OrganizationProvisioningCompletedFollowupConsumerService consumerService;
  private OrganizationProvisioningCompletedFollowupRabbitListener listener;

  @BeforeEach
  void setUp() {
    consumerService =
        org.mockito.Mockito.mock(OrganizationProvisioningCompletedFollowupConsumerService.class);
    listener = new OrganizationProvisioningCompletedFollowupRabbitListener(consumerService);
  }

  @Test
  void onMessageDelegatesOrganizationProvisioningFollowupTask() {
    Message message =
        message(
            "{\"jobId\":31}",
            "msg_followup_31",
            "evt_1",
            "organization-provisioning-completed-followup:31",
            OrganizationProvisioningCompletedFollowupPublisher.TASK_TYPE);

    listener.onMessage(message);

    ArgumentCaptor<OrganizationProvisioningCompletedFollowupConsumeRequest> captor =
        ArgumentCaptor.forClass(OrganizationProvisioningCompletedFollowupConsumeRequest.class);
    verify(consumerService).consume(captor.capture());
    OrganizationProvisioningCompletedFollowupConsumeRequest request = captor.getValue();
    assertThat(request.eventId()).isEqualTo("evt_1");
    assertThat(request.idempotencyKey())
        .isEqualTo("organization-provisioning-completed-followup:31");
    assertThat(request.messageId()).isEqualTo("msg_followup_31");
    assertThat(request.payload()).isEqualTo("{\"jobId\":31}");
    assertThat(request.taskType())
        .isEqualTo(OrganizationProvisioningCompletedFollowupPublisher.TASK_TYPE);
  }

  @Test
  void onMessageSkipsOtherLightTaskTypes() {
    Message message =
        message(
            "{}",
            "msg_other",
            "evt_other",
            "other-task:1",
            "investment.radar.rebuild");

    listener.onMessage(message);

    verify(consumerService, never()).consume(org.mockito.ArgumentMatchers.any());
  }

  private Message message(
      String payload, String messageId, String eventId, String idempotencyKey, String taskType) {
    MessageProperties properties = new MessageProperties();
    properties.setMessageId(messageId);
    properties.setHeader("eventId", eventId);
    properties.setHeader("idempotencyKey", idempotencyKey);
    properties.setHeader("taskType", taskType);
    return new Message(payload.getBytes(StandardCharsets.UTF_8), properties);
  }
}

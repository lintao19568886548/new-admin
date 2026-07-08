package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessagePublisher;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessageRequest;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** 组织开通完成后续轻任务投递测试；只验证 RabbitMQ light-task 请求封装。 */
class OrganizationProvisioningCompletedFollowupPublisherTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  @Test
  void publishQueuesRabbitLightTaskWithStableIdempotencyKey() throws Exception {
    RabbitMessagePublisher rabbitMessagePublisher =
        org.mockito.Mockito.mock(RabbitMessagePublisher.class);
    when(rabbitMessagePublisher.publishLightTask(org.mockito.ArgumentMatchers.any()))
        .thenReturn("msg_followup_31");
    OrganizationProvisioningCompletedFollowupPublisher publisher =
        new OrganizationProvisioningCompletedFollowupPublisher(rabbitMessagePublisher);

    String messageId =
        publisher.publish(
            request(),
            Map.of(
                "jobId",
                31,
                "status",
                "active",
                "step",
                "completed",
                "targetCustomerId",
                "org001",
                "targetDbName",
                "tenant_org001"),
            31,
            "org001",
            "tenant_org001");

    assertThat(messageId).isEqualTo("msg_followup_31");
    ArgumentCaptor<RabbitMessageRequest> captor =
        ArgumentCaptor.forClass(RabbitMessageRequest.class);
    verify(rabbitMessagePublisher).publishLightTask(captor.capture());
    RabbitMessageRequest message = captor.getValue();
    assertThat(message.aggregateId()).isEqualTo("31");
    assertThat(message.aggregateType()).isEqualTo("tenant_provisioning_job");
    assertThat(message.customerId()).isEqualTo("org001");
    assertThat(message.idempotencyKey())
        .isEqualTo("organization-provisioning-completed-followup:31");
    assertThat(message.messageId()).isEqualTo("organization-provisioning-completed-followup-31");
    assertThat(message.headers())
        .containsEntry("eventId", "evt_1")
        .containsEntry("eventType", "organization.provisioning.completed")
        .containsEntry(
            "taskType", OrganizationProvisioningCompletedFollowupPublisher.TASK_TYPE);

    Map<String, Object> payload =
        JSON.readValue(message.payload(), new TypeReference<Map<String, Object>>() {});
    assertThat(payload)
        .containsEntry("eventId", "evt_1")
        .containsEntry("eventType", "organization.provisioning.completed")
        .containsEntry("jobId", 31)
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001")
        .containsEntry("taskType", OrganizationProvisioningCompletedFollowupPublisher.TASK_TYPE);
  }

  private OrganizationProvisioningCompletedConsumeRequest request() {
    return new OrganizationProvisioningCompletedConsumeRequest(
        "backend-springboot",
        "org001",
        "evt_1",
        "organization.provisioning.completed",
        "organization-provisioning-completed:31",
        "{\"jobId\":31}",
        "magic.organization.provisioning");
  }
}

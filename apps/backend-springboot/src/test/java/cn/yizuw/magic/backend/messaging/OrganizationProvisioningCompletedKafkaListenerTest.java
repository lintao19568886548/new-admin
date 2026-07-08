package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.nio.charset.StandardCharsets;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** 组织空间开通完成 Kafka listener 测试；只验证事件过滤和请求组装。 */
class OrganizationProvisioningCompletedKafkaListenerTest {

  private OrganizationProvisioningCompletedConsumerService consumerService;
  private OrganizationProvisioningCompletedKafkaListener listener;

  @BeforeEach
  void setUp() {
    consumerService =
        org.mockito.Mockito.mock(OrganizationProvisioningCompletedConsumerService.class);
    listener =
        new OrganizationProvisioningCompletedKafkaListener("backend-springboot", consumerService);
  }

  @Test
  void onMessageDelegatesCompletedEvent() {
    ConsumerRecord<String, String> record =
        new ConsumerRecord<>(
            "magic.organization.provisioning",
            0,
            12L,
            "organization-provisioning-completed:31",
            "{\"jobId\":31}");
    record.headers().add(header("eventId", "evt_1"));
    record.headers().add(header("eventType", "organization.provisioning.completed"));
    record.headers().add(header("customerId", "org001"));
    record.headers().add(header("idempotencyKey", "organization-provisioning-completed:31"));

    listener.onMessage(record);

    ArgumentCaptor<OrganizationProvisioningCompletedConsumeRequest> captor =
        ArgumentCaptor.forClass(OrganizationProvisioningCompletedConsumeRequest.class);
    verify(consumerService).consume(captor.capture());
    OrganizationProvisioningCompletedConsumeRequest request = captor.getValue();
    assertThat(request.consumerGroup()).isEqualTo("backend-springboot");
    assertThat(request.customerId()).isEqualTo("org001");
    assertThat(request.eventId()).isEqualTo("evt_1");
    assertThat(request.eventType()).isEqualTo("organization.provisioning.completed");
    assertThat(request.idempotencyKey()).isEqualTo("organization-provisioning-completed:31");
    assertThat(request.payload()).isEqualTo("{\"jobId\":31}");
    assertThat(request.topic()).isEqualTo("magic.organization.provisioning");
  }

  @Test
  void onMessageSkipsOtherOrganizationEvents() {
    ConsumerRecord<String, String> record =
        new ConsumerRecord<>(
            "magic.organization.provisioning",
            0,
            13L,
            "organization-provisioning-requeued:31",
            "{}");
    record.headers().add(header("eventType", "organization.provisioning.requeued"));

    listener.onMessage(record);

    verify(consumerService, never()).consume(org.mockito.ArgumentMatchers.any());
  }

  private RecordHeader header(String name, String value) {
    return new RecordHeader(name, value.getBytes(StandardCharsets.UTF_8));
  }
}

package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** 组织空间开通完成事件消费者测试；当前批次只验证幂等日志和边界。 */
class OrganizationProvisioningCompletedConsumerServiceTest {

  private EventConsumeLogRepository eventConsumeLogRepository;
  private OrganizationProvisioningCompletedFollowupPublisher followupPublisher;
  private OrganizationProvisioningCompletedConsumerService consumerService;

  @BeforeEach
  void setUp() {
    eventConsumeLogRepository = org.mockito.Mockito.mock(EventConsumeLogRepository.class);
    followupPublisher =
        org.mockito.Mockito.mock(OrganizationProvisioningCompletedFollowupPublisher.class);
    consumerService =
        new OrganizationProvisioningCompletedConsumerService(
            eventConsumeLogRepository, followupPublisher);
  }

  @Test
  void consumeClaimsEventAndQueuesRabbitLightTaskWhenCompletedEventFirstSeen() {
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.CLAIMED);
    when(followupPublisher.publish(any(), any(), anyInt(), any(String.class), any(String.class)))
        .thenReturn("msg_followup_31");

    OrganizationProvisioningCompletedConsumeResult result = consumerService.consume(request());

    assertThat(result.consumed()).isTrue();
    assertThat(result.duplicate()).isFalse();
    assertThat(result.followupTaskQueued()).isTrue();
    assertThat(result.followupTaskMessageId()).isEqualTo("msg_followup_31");
    assertThat(result.status()).isEqualTo("success");
    assertThat(result.reason()).isEqualTo("rabbit_light_task_queued");
    assertThat(result.jobId()).isEqualTo(31);
    assertThat(result.targetCustomerId()).isEqualTo("org001");
    assertThat(result.targetDbName()).isEqualTo("tenant_org001");
    verify(eventConsumeLogRepository).claimProcessing(any());
    verify(followupPublisher).publish(any(), any(), anyInt(), any(String.class), any(String.class));
    verify(eventConsumeLogRepository).markSuccess(any());
  }

  @Test
  void consumeSkipsDuplicateCompletedEvent() {
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.DUPLICATE_SUCCESS);

    OrganizationProvisioningCompletedConsumeResult result = consumerService.consume(request());

    assertThat(result.consumed()).isFalse();
    assertThat(result.duplicate()).isTrue();
    assertThat(result.followupTaskQueued()).isFalse();
    assertThat(result.status()).isEqualTo("duplicate");
    assertThat(result.reason()).isEqualTo("already_consumed");
    verify(followupPublisher, never())
        .publish(any(), any(), anyInt(), any(String.class), any(String.class));
    verify(eventConsumeLogRepository, never()).markSuccess(any());
  }

  @Test
  void consumeSkipsEventAlreadyBeingProcessedByAnotherConsumer() {
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.IN_PROGRESS);

    OrganizationProvisioningCompletedConsumeResult result = consumerService.consume(request());

    assertThat(result.consumed()).isFalse();
    assertThat(result.duplicate()).isTrue();
    assertThat(result.status()).isEqualTo("duplicate");
    assertThat(result.reason()).isEqualTo("already_processing");
    verify(followupPublisher, never())
        .publish(any(), any(), anyInt(), any(String.class), any(String.class));
    verify(eventConsumeLogRepository, never()).markSuccess(any());
  }

  @Test
  void consumeMarksFailureAndRethrowsWhenRabbitLightTaskPublishFails() {
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.CLAIMED);
    when(followupPublisher.publish(any(), any(), anyInt(), any(String.class), any(String.class)))
        .thenThrow(new IllegalStateException("rabbit down"));

    assertThatThrownBy(() -> consumerService.consume(request()))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("rabbit down");

    verify(eventConsumeLogRepository)
        .markFailure(
            any(), org.mockito.ArgumentMatchers.contains("RabbitMQ followup publish failed"));
    verify(eventConsumeLogRepository, never()).markSuccess(any());
  }

  @Test
  void consumeSkipsUnsupportedEventTypeWithoutWritingLog() {
    OrganizationProvisioningCompletedConsumeResult result =
        consumerService.consume(
            new OrganizationProvisioningCompletedConsumeRequest(
                "backend-springboot",
                "org001",
                "evt_2",
                "organization.provisioning.requeued",
                "organization-provisioning-requeued:31",
                "{}",
                "magic.organization.provisioning"));

    assertThat(result.status()).isEqualTo("skipped");
    assertThat(result.reason()).isEqualTo("unsupported_event_type");
    verify(followupPublisher, never())
        .publish(any(), any(), anyInt(), any(String.class), any(String.class));
    verify(eventConsumeLogRepository, never()).recordSuccess(any());
    verify(eventConsumeLogRepository, never()).recordFailure(any(), any());
  }

  @Test
  void consumeRejectsMissingHeadersWithoutWritingLog() {
    OrganizationProvisioningCompletedConsumeResult result =
        consumerService.consume(
            new OrganizationProvisioningCompletedConsumeRequest(
                "backend-springboot",
                null,
                null,
                "organization.provisioning.completed",
                "",
                "{}",
                "magic.organization.provisioning"));

    assertThat(result.status()).isEqualTo("invalid");
    assertThat(result.reason()).contains("missing_headers:customerId,eventId,idempotencyKey");
    verify(followupPublisher, never())
        .publish(any(), any(), anyInt(), any(String.class), any(String.class));
    verify(eventConsumeLogRepository, never()).recordSuccess(any());
    verify(eventConsumeLogRepository, never()).recordFailure(any(), any());
  }

  @Test
  void consumeRecordsFailureForInvalidPayload() {
    when(eventConsumeLogRepository.recordFailure(any(), any())).thenReturn(true);

    OrganizationProvisioningCompletedConsumeResult result =
        consumerService.consume(
            new OrganizationProvisioningCompletedConsumeRequest(
                "backend-springboot",
                "org001",
                "evt_bad",
                "organization.provisioning.completed",
                "organization-provisioning-completed:31",
                "{bad-json",
                "magic.organization.provisioning"));

    assertThat(result.consumed()).isFalse();
    assertThat(result.duplicate()).isFalse();
    assertThat(result.status()).isEqualTo("failed");
    assertThat(result.reason()).isEqualTo("invalid_payload");
    verify(eventConsumeLogRepository)
        .recordFailure(any(), org.mockito.ArgumentMatchers.contains("invalid payload"));
  }

  @Test
  void consumeRecordsFailureWhenRequiredPayloadFieldsAreMissing() {
    when(eventConsumeLogRepository.recordFailure(any(), any())).thenReturn(true);

    OrganizationProvisioningCompletedConsumeResult result =
        consumerService.consume(
            new OrganizationProvisioningCompletedConsumeRequest(
                "backend-springboot",
                "org001",
                "evt_incomplete",
                "organization.provisioning.completed",
                "organization-provisioning-completed:31",
                "{\"status\":\"active\"}",
                "magic.organization.provisioning"));

    assertThat(result.status()).isEqualTo("failed");
    assertThat(result.reason()).isEqualTo("invalid_payload");
    verify(eventConsumeLogRepository)
        .recordFailure(
            any(), org.mockito.ArgumentMatchers.contains("missing payload fields: jobId"));
  }

  @Test
  void consumeRecordsFailureWhenCustomerHeaderDoesNotMatchPayload() {
    when(eventConsumeLogRepository.recordFailure(any(), any())).thenReturn(true);

    OrganizationProvisioningCompletedConsumeResult result =
        consumerService.consume(
            new OrganizationProvisioningCompletedConsumeRequest(
                "backend-springboot",
                "org-header",
                "evt_mismatch",
                "organization.provisioning.completed",
                "organization-provisioning-completed:31",
                """
                {
                  "jobId": 31,
                  "targetCustomerId": "org-payload",
                  "targetDbName": "tenant_org001"
                }
                """,
                "magic.organization.provisioning"));

    assertThat(result.status()).isEqualTo("failed");
    assertThat(result.reason()).isEqualTo("invalid_payload");
    verify(eventConsumeLogRepository)
        .recordFailure(
            any(), org.mockito.ArgumentMatchers.contains("customerId header mismatch"));
    verify(followupPublisher, never())
        .publish(any(), any(), anyInt(), any(String.class), any(String.class));
  }

  private OrganizationProvisioningCompletedConsumeRequest request() {
    return new OrganizationProvisioningCompletedConsumeRequest(
        "backend-springboot",
        "org001",
        "evt_1",
        "organization.provisioning.completed",
        "organization-provisioning-completed:31",
        """
        {
          "jobId": 31,
          "targetCustomerId": "org001",
          "targetDbName": "tenant_org001",
          "status": "active",
          "step": "completed"
        }
        """,
        "magic.organization.provisioning");
  }
}

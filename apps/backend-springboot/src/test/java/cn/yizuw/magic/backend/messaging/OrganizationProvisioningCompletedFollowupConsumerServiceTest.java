package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** RabbitMQ followup 轻任务消费测试；当前只验证幂等日志、后续计划和边界。 */
class OrganizationProvisioningCompletedFollowupConsumerServiceTest {

  private EventConsumeLogRepository eventConsumeLogRepository;
  private OrganizationProvisioningCompletedNotificationPublisher notificationPublisher;
  private OrganizationProvisioningCompletedNotificationPlanService notificationPlanService;
  private OrganizationProvisioningCompletedRedisRefreshExecutor redisRefreshExecutor;
  private OrganizationProvisioningCompletedRedisRefreshPlanService redisRefreshPlanService;
  private OrganizationProvisioningCompletedFollowupConsumerService consumerService;

  @BeforeEach
  void setUp() {
    eventConsumeLogRepository = org.mockito.Mockito.mock(EventConsumeLogRepository.class);
    notificationPublisher =
        org.mockito.Mockito.mock(OrganizationProvisioningCompletedNotificationPublisher.class);
    notificationPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningCompletedNotificationPlanService.class);
    redisRefreshExecutor =
        org.mockito.Mockito.mock(OrganizationProvisioningCompletedRedisRefreshExecutor.class);
    redisRefreshPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningCompletedRedisRefreshPlanService.class);
    consumerService =
        new OrganizationProvisioningCompletedFollowupConsumerService(
            eventConsumeLogRepository,
            notificationPublisher,
            notificationPlanService,
            redisRefreshExecutor,
            redisRefreshPlanService);
  }

  @Test
  void consumeClaimsSuccessAndGeneratesPlansWhenNotificationPublishDisabled() {
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.CLAIMED);
    when(notificationPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenReturn(
            Map.of(
                "planStatus",
                "preview_only",
                "rabbitNotificationPublishEnabled",
                false,
                "sendEnabled",
                false));
    when(redisRefreshPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenReturn(Map.of("planStatus", "preview_only", "refreshEnabled", false));

    OrganizationProvisioningCompletedFollowupConsumeResult result =
        consumerService.consume(request());

    assertThat(result.consumed()).isTrue();
    assertThat(result.duplicate()).isFalse();
    assertThat(result.eventId()).isEqualTo("evt_1");
    assertThat(result.jobId()).isEqualTo(31);
    assertThat(result.notificationMessagePublished()).isFalse();
    assertThat(result.notificationMessageId()).isNull();
    assertThat(result.notificationPlanGenerated()).isTrue();
    assertThat(result.notificationPlan())
        .containsEntry("planStatus", "preview_only")
        .containsEntry("sendEnabled", false);
    assertThat(result.redisRefreshPlanGenerated()).isTrue();
    assertThat(result.redisRefreshPlan())
        .containsEntry("planStatus", "preview_only")
        .containsEntry("refreshEnabled", false);
    assertThat(result.reason()).isEqualTo("followup_plans_generated");
    assertThat(result.status()).isEqualTo("success");
    assertThat(result.targetCustomerId()).isEqualTo("org001");
    assertThat(result.targetDbName()).isEqualTo("tenant_org001");
    verify(eventConsumeLogRepository).claimProcessing(any());
    verify(eventConsumeLogRepository).markSuccess(any());
    verify(notificationPublisher, never()).publish(any());
    verify(redisRefreshExecutor, never()).refresh(any());
    verify(notificationPlanService).buildPlan(31, "org001", "tenant_org001");
    verify(redisRefreshPlanService).buildPlan(31, "org001", "tenant_org001");
  }

  @Test
  void consumePublishesNotificationMessageWhenSafetyGateEnabled() {
    Map<String, Object> notificationPlan = notificationPlan(true);
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.CLAIMED);
    when(notificationPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenReturn(notificationPlan);
    when(redisRefreshPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenReturn(Map.of("planStatus", "preview_only", "refreshEnabled", false));
    when(notificationPublisher.publish(notificationPlan)).thenReturn("msg_notification_31");

    OrganizationProvisioningCompletedFollowupConsumeResult result =
        consumerService.consume(request());

    assertThat(result.consumed()).isTrue();
    assertThat(result.notificationMessagePublished()).isTrue();
    assertThat(result.notificationMessageId()).isEqualTo("msg_notification_31");
    assertThat(result.reason()).isEqualTo("notification_message_published");
    assertThat(result.notificationPlan())
        .containsEntry("planStatus", "rabbit_notification_queued")
        .containsEntry("rabbitNotificationDryRun", false)
        .containsEntry("rabbitNotificationPublishRequested", true)
        .containsEntry("rabbitNotificationPublishExecuted", true)
        .containsEntry("rabbitNotificationMessageId", "msg_notification_31");
    @SuppressWarnings("unchecked")
    Map<String, Object> preview =
        (Map<String, Object>) result.notificationPlan().get("rabbitMessagePreview");
    assertThat(preview).containsEntry("publishExecuted", true);
    verify(notificationPublisher).publish(notificationPlan);
    verify(redisRefreshExecutor, never()).refresh(any());
    verify(eventConsumeLogRepository).markSuccess(any());
  }

  @Test
  void consumeRefreshesRedisCachesWhenSafetyGateEnabled() {
    Map<String, Object> redisRefreshPlan = redisRefreshPlan(true);
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.CLAIMED);
    when(notificationPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenReturn(notificationPlan(false));
    when(redisRefreshPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenReturn(redisRefreshPlan);
    when(redisRefreshExecutor.refresh(redisRefreshPlan)).thenReturn(5);

    OrganizationProvisioningCompletedFollowupConsumeResult result =
        consumerService.consume(request());

    assertThat(result.consumed()).isTrue();
    assertThat(result.notificationMessagePublished()).isFalse();
    assertThat(result.reason()).isEqualTo("redis_cache_evicted");
    assertThat(result.redisRefreshPlan())
        .containsEntry("planStatus", "cache_evicted")
        .containsEntry("cacheEvictRequested", true)
        .containsEntry("cacheEvictExecuted", true)
        .containsEntry("cacheEvictPrefixCount", 5);
    verify(redisRefreshExecutor).refresh(redisRefreshPlan);
    verify(notificationPublisher, never()).publish(any());
    verify(eventConsumeLogRepository).markSuccess(any());
  }

  @Test
  void consumeSkipsDuplicateFollowupTask() {
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.DUPLICATE_SUCCESS);

    OrganizationProvisioningCompletedFollowupConsumeResult result =
        consumerService.consume(request());

    assertThat(result.consumed()).isFalse();
    assertThat(result.duplicate()).isTrue();
    assertThat(result.reason()).isEqualTo("already_consumed");
    assertThat(result.status()).isEqualTo("duplicate");
    assertThat(result.notificationMessagePublished()).isFalse();
    assertThat(result.notificationMessageId()).isNull();
    assertThat(result.notificationPlanGenerated()).isFalse();
    assertThat(result.notificationPlan()).isEmpty();
    assertThat(result.redisRefreshPlanGenerated()).isFalse();
    assertThat(result.redisRefreshPlan()).isEmpty();
    verify(eventConsumeLogRepository).claimProcessing(any());
    verify(eventConsumeLogRepository, never()).markSuccess(any());
    verify(notificationPublisher, never()).publish(any());
    verify(notificationPlanService, never()).buildPlan(anyInt(), any(), any());
    verify(redisRefreshPlanService, never()).buildPlan(anyInt(), any(), any());
  }

  @Test
  void consumeSkipsAlreadyProcessingFollowupTask() {
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.IN_PROGRESS);

    OrganizationProvisioningCompletedFollowupConsumeResult result =
        consumerService.consume(request());

    assertThat(result.consumed()).isFalse();
    assertThat(result.duplicate()).isTrue();
    assertThat(result.reason()).isEqualTo("already_processing");
    assertThat(result.status()).isEqualTo("duplicate");
    verify(notificationPublisher, never()).publish(any());
    verify(notificationPlanService, never()).buildPlan(anyInt(), any(), any());
  }

  @Test
  void consumeSkipsUnsupportedLightTaskTypeWithoutWritingLog() {
    OrganizationProvisioningCompletedFollowupConsumeResult result =
        consumerService.consume(
            new OrganizationProvisioningCompletedFollowupConsumeRequest(
                "evt_other",
                "other-task:31",
                "msg_other",
                "{}",
                "investment.radar.rebuild"));

    assertThat(result.status()).isEqualTo("skipped");
    assertThat(result.reason()).isEqualTo("unsupported_task_type");
    assertThat(result.notificationPlanGenerated()).isFalse();
    assertThat(result.redisRefreshPlanGenerated()).isFalse();
    verify(eventConsumeLogRepository, never()).claimProcessing(any());
    verify(eventConsumeLogRepository, never()).recordFailure(any(), any());
    verify(notificationPlanService, never()).buildPlan(anyInt(), any(), any());
    verify(redisRefreshPlanService, never()).buildPlan(anyInt(), any(), any());
  }

  @Test
  void consumeRejectsMissingHeadersWithoutWritingLog() {
    OrganizationProvisioningCompletedFollowupConsumeResult result =
        consumerService.consume(
            new OrganizationProvisioningCompletedFollowupConsumeRequest(
                null,
                "",
                null,
                "{}",
                OrganizationProvisioningCompletedFollowupPublisher.TASK_TYPE));

    assertThat(result.status()).isEqualTo("invalid");
    assertThat(result.reason()).contains("missing_headers:eventId,idempotencyKey");
    assertThat(result.notificationPlanGenerated()).isFalse();
    assertThat(result.redisRefreshPlanGenerated()).isFalse();
    verify(eventConsumeLogRepository, never()).claimProcessing(any());
    verify(eventConsumeLogRepository, never()).recordFailure(any(), any());
    verify(notificationPlanService, never()).buildPlan(anyInt(), any(), any());
    verify(redisRefreshPlanService, never()).buildPlan(anyInt(), any(), any());
  }

  @Test
  void consumeUsesMessageIdWhenEventIdHeaderIsMissing() {
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.CLAIMED);
    when(notificationPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenReturn(Map.of("planStatus", "preview_only", "rabbitNotificationPublishEnabled", false));
    when(redisRefreshPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenReturn(Map.of("planStatus", "preview_only"));

    OrganizationProvisioningCompletedFollowupConsumeResult result =
        consumerService.consume(
            new OrganizationProvisioningCompletedFollowupConsumeRequest(
                null,
                "organization-provisioning-completed-followup:31",
                "msg_followup_31",
                payload(),
                OrganizationProvisioningCompletedFollowupPublisher.TASK_TYPE));

    assertThat(result.eventId()).isEqualTo("msg_followup_31");
    assertThat(result.status()).isEqualTo("success");
    assertThat(result.notificationPlanGenerated()).isTrue();
    assertThat(result.redisRefreshPlanGenerated()).isTrue();
    verify(eventConsumeLogRepository).claimProcessing(any());
    verify(eventConsumeLogRepository).markSuccess(any());
    verify(notificationPlanService).buildPlan(31, "org001", "tenant_org001");
    verify(redisRefreshPlanService).buildPlan(31, "org001", "tenant_org001");
  }

  @Test
  void consumeMarksFailureAndRethrowsWhenNotificationPublishFails() {
    Map<String, Object> notificationPlan = notificationPlan(true);
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.CLAIMED);
    when(notificationPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenReturn(notificationPlan);
    when(redisRefreshPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenReturn(Map.of("planStatus", "preview_only"));
    when(notificationPublisher.publish(notificationPlan))
        .thenThrow(new IllegalStateException("rabbit down"));

    assertThatThrownBy(() -> consumerService.consume(request()))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("rabbit down");

    verify(eventConsumeLogRepository)
        .markFailure(
            any(), org.mockito.ArgumentMatchers.contains("RabbitMQ notification publish failed"));
    verify(eventConsumeLogRepository, never()).markSuccess(any());
  }

  @Test
  void consumeMarksFailureAndRethrowsWhenRedisRefreshFails() {
    Map<String, Object> redisRefreshPlan = redisRefreshPlan(true);
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.CLAIMED);
    when(notificationPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenReturn(notificationPlan(false));
    when(redisRefreshPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenReturn(redisRefreshPlan);
    when(redisRefreshExecutor.refresh(redisRefreshPlan))
        .thenThrow(new IllegalStateException("redis down"));

    assertThatThrownBy(() -> consumerService.consume(request()))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("redis down");

    verify(eventConsumeLogRepository)
        .markFailure(any(), org.mockito.ArgumentMatchers.contains("redis_cache_evict"));
    verify(eventConsumeLogRepository, never()).markSuccess(any());
    verify(notificationPublisher, never()).publish(any());
  }

  @Test
  void consumeMarksFailureAndRethrowsWhenNotificationPlanFails() {
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.CLAIMED);
    when(notificationPlanService.buildPlan(31, "org001", "tenant_org001"))
        .thenThrow(new IllegalStateException("plan down"));

    assertThatThrownBy(() -> consumerService.consume(request()))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("plan down");

    verify(eventConsumeLogRepository)
        .markFailure(
            any(), org.mockito.ArgumentMatchers.contains("notification_plan"));
    verify(eventConsumeLogRepository, never()).markSuccess(any());
    verify(redisRefreshPlanService, never()).buildPlan(anyInt(), any(), any());
    verify(redisRefreshExecutor, never()).refresh(any());
    verify(notificationPublisher, never()).publish(any());
  }

  @Test
  void consumeRecordsFailureForInvalidPayload() {
    when(eventConsumeLogRepository.recordFailure(any(), any())).thenReturn(true);

    OrganizationProvisioningCompletedFollowupConsumeResult result =
        consumerService.consume(
            new OrganizationProvisioningCompletedFollowupConsumeRequest(
                "evt_bad",
                "organization-provisioning-completed-followup:31",
                "msg_bad",
                "{bad-json",
                OrganizationProvisioningCompletedFollowupPublisher.TASK_TYPE));

    assertThat(result.consumed()).isFalse();
    assertThat(result.status()).isEqualTo("failed");
    assertThat(result.reason()).isEqualTo("invalid_payload");
    assertThat(result.notificationPlanGenerated()).isFalse();
    assertThat(result.redisRefreshPlanGenerated()).isFalse();
    verify(eventConsumeLogRepository)
        .recordFailure(any(), org.mockito.ArgumentMatchers.contains("invalid payload"));
    verify(eventConsumeLogRepository, never()).claimProcessing(any());
    verify(notificationPlanService, never()).buildPlan(anyInt(), any(), any());
    verify(redisRefreshPlanService, never()).buildPlan(anyInt(), any(), any());
  }

  @Test
  void consumeRecordsFailureWhenRequiredPayloadFieldsAreMissing() {
    when(eventConsumeLogRepository.recordFailure(any(), any())).thenReturn(true);

    OrganizationProvisioningCompletedFollowupConsumeResult result =
        consumerService.consume(
            new OrganizationProvisioningCompletedFollowupConsumeRequest(
                "evt_incomplete",
                "organization-provisioning-completed-followup:31",
                "msg_incomplete",
                "{\"jobId\":31}",
                OrganizationProvisioningCompletedFollowupPublisher.TASK_TYPE));

    assertThat(result.status()).isEqualTo("failed");
    assertThat(result.reason()).isEqualTo("invalid_payload");
    assertThat(result.notificationPlanGenerated()).isFalse();
    assertThat(result.redisRefreshPlanGenerated()).isFalse();
    verify(eventConsumeLogRepository)
        .recordFailure(
            any(),
            org.mockito.ArgumentMatchers.contains("missing payload fields: targetCustomerId"));
    verify(eventConsumeLogRepository, never()).claimProcessing(any());
    verify(notificationPlanService, never()).buildPlan(anyInt(), any(), any());
    verify(redisRefreshPlanService, never()).buildPlan(anyInt(), any(), any());
  }

  private Map<String, Object> notificationPlan(boolean publishEnabled) {
    Map<String, Object> plan = new LinkedHashMap<>();
    Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("publishExecuted", false);
    plan.put("rabbitMessagePreview", preview);
    plan.put("rabbitNotificationPublishEnabled", publishEnabled);
    plan.put("rabbitNotificationPublishExecuted", false);
    plan.put("rabbitNotificationPublishRequested", false);
    return plan;
  }

  private Map<String, Object> redisRefreshPlan(boolean refreshEnabled) {
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planStatus", "preview_only");
    plan.put("cacheEvictEnabled", refreshEnabled);
    plan.put("cacheEvictExecuted", false);
    plan.put("cacheEvictRequested", false);
    return plan;
  }

  private OrganizationProvisioningCompletedFollowupConsumeRequest request() {
    return new OrganizationProvisioningCompletedFollowupConsumeRequest(
        "evt_1",
        "organization-provisioning-completed-followup:31",
        "msg_followup_31",
        payload(),
        OrganizationProvisioningCompletedFollowupPublisher.TASK_TYPE);
  }

  private String payload() {
    return """
        {
          "eventId": "evt_1",
          "eventType": "organization.provisioning.completed",
          "idempotencyKey": "organization-provisioning-completed:31",
          "jobId": 31,
          "targetCustomerId": "org001",
          "targetDbName": "tenant_org001",
          "taskType": "organization.provisioning.completed.followup"
        }
        """;
  }
}

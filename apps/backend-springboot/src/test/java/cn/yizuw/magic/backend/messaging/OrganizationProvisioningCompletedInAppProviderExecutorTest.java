package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** in_app provider 执行器测试；第 167 批只允许真实 claim，不写业务表。 */
class OrganizationProvisioningCompletedInAppProviderExecutorTest {

  private AppProperties appProperties;
  private EventConsumeLogRepository eventConsumeLogRepository;
  private OrganizationProvisioningCompletedInAppNotificationRepository notificationRepository;
  private OrganizationProvisioningCompletedInAppProviderExecutor executor;

  @BeforeEach
  void setUp() {
    appProperties = new AppProperties();
    eventConsumeLogRepository = org.mockito.Mockito.mock(EventConsumeLogRepository.class);
    notificationRepository =
        org.mockito.Mockito.mock(OrganizationProvisioningCompletedInAppNotificationRepository.class);
    executor =
        new OrganizationProvisioningCompletedInAppProviderExecutor(
            appProperties, eventConsumeLogRepository, notificationRepository);
  }

  @Test
  void claimReturnsDryRunWhenClaimGateIsDisabled() {
    OrganizationProvisioningCompletedInAppProviderClaimResult result =
        executor.claim(readyPreflight());

    assertThat(result.accepted()).isFalse();
    assertThat(result.duplicate()).isFalse();
    assertThat(result.claimAttempted()).isFalse();
    assertThat(result.claimExecuted()).isFalse();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.markSuccessExecuted()).isFalse();
    assertThat(result.markFailureExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("claim_gate_disabled");
    assertThat(result.status()).isEqualTo("dry_run");
    verify(eventConsumeLogRepository, never()).claimProcessing(any());
  }

  @Test
  void claimReturnsBlockedWhenPreflightIsBlocked() {
    Map<String, Object> preflight =
        Map.of(
            "claimReady",
            false,
            "blockedReasons",
            List.of("in_app_notification 手工 DDL 尚未确认应用"));

    OrganizationProvisioningCompletedInAppProviderClaimResult result = executor.claim(preflight);

    assertThat(result.accepted()).isFalse();
    assertThat(result.claimAttempted()).isFalse();
    assertThat(result.claimExecuted()).isFalse();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("preflight_blocked");
    assertThat(result.status()).isEqualTo("blocked");
    verify(eventConsumeLogRepository, never()).claimProcessing(any());
  }

  @Test
  void claimWritesProcessingConsumeLogWhenGateIsEnabledAndClaimed() {
    appProperties.getRabbitMq().setOrganizationProvisioningInAppProviderClaimEnabled(true);
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.CLAIMED);

    OrganizationProvisioningCompletedInAppProviderClaimResult result =
        executor.claim(readyPreflight());

    assertThat(result.accepted()).isTrue();
    assertThat(result.duplicate()).isFalse();
    assertThat(result.claimAttempted()).isTrue();
    assertThat(result.claimExecuted()).isTrue();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.markSuccessExecuted()).isFalse();
    assertThat(result.markFailureExecuted()).isFalse();
    assertThat(result.claimResult()).isEqualTo(EventConsumeClaimResult.CLAIMED);
    assertThat(result.reason()).isEqualTo("claimed_write_deferred");
    assertThat(result.status()).isEqualTo("processing");

    ArgumentCaptor<EventConsumeLogEntry> entryCaptor =
        ArgumentCaptor.forClass(EventConsumeLogEntry.class);
    verify(eventConsumeLogRepository).claimProcessing(entryCaptor.capture());
    assertThat(entryCaptor.getValue())
        .extracting(
            EventConsumeLogEntry::consumerGroup,
            EventConsumeLogEntry::eventId,
            EventConsumeLogEntry::eventType,
            EventConsumeLogEntry::idempotencyKey,
            EventConsumeLogEntry::topic)
        .containsExactly(
            "provider-in-app-organization-provisioning-completed",
            "evt_notification_31:in_app",
            "provider.organization.provisioning.completed.in_app_notification",
            "organization-provisioning-completed-provider:31:in_app",
            "magic.notification.queue");
  }

  @Test
  void claimReturnsDuplicateWhenConsumeLogAlreadySucceeded() {
    appProperties.getRabbitMq().setOrganizationProvisioningInAppProviderClaimEnabled(true);
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.DUPLICATE_SUCCESS);

    OrganizationProvisioningCompletedInAppProviderClaimResult result =
        executor.claim(readyPreflight());

    assertThat(result.accepted()).isFalse();
    assertThat(result.duplicate()).isTrue();
    assertThat(result.claimAttempted()).isTrue();
    assertThat(result.claimExecuted()).isFalse();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("already_consumed");
    assertThat(result.status()).isEqualTo("duplicate");
  }

  @Test
  void claimReturnsDuplicateWhenConsumeLogIsInProgress() {
    appProperties.getRabbitMq().setOrganizationProvisioningInAppProviderClaimEnabled(true);
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.IN_PROGRESS);

    OrganizationProvisioningCompletedInAppProviderClaimResult result =
        executor.claim(readyPreflight());

    assertThat(result.accepted()).isFalse();
    assertThat(result.duplicate()).isTrue();
    assertThat(result.claimAttempted()).isTrue();
    assertThat(result.claimExecuted()).isFalse();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("already_processing");
    assertThat(result.status()).isEqualTo("duplicate");
  }

  @Test
  void insertNotificationsReturnsBlockedWhenClaimWasNotAccepted() {
    OrganizationProvisioningCompletedInAppNotificationInsertResult result =
        executor.insertNotifications(null, readyInsertPlan());

    assertThat(result.accepted()).isFalse();
    assertThat(result.insertAttempted()).isFalse();
    assertThat(result.insertExecuted()).isFalse();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.markSuccessExecuted()).isFalse();
    assertThat(result.markFailureExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("claim_not_accepted");
    assertThat(result.status()).isEqualTo("blocked");
    verify(notificationRepository, never()).insertRows(any());
  }

  @Test
  void insertNotificationsReturnsDryRunWhenInsertGateIsDisabled() {
    OrganizationProvisioningCompletedInAppNotificationInsertResult result =
        executor.insertNotifications(acceptedClaim(), readyInsertPlan());

    assertThat(result.accepted()).isFalse();
    assertThat(result.insertAttempted()).isFalse();
    assertThat(result.insertExecuted()).isFalse();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.requestedRows()).isEqualTo(1);
    assertThat(result.reason()).isEqualTo("insert_gate_disabled");
    assertThat(result.status()).isEqualTo("dry_run");
    verify(notificationRepository, never()).insertRows(any());
  }

  @Test
  void insertNotificationsWritesRowsWhenInsertGateIsEnabled() {
    appProperties.getRabbitMq().setOrganizationProvisioningInAppNotificationInsertEnabled(true);
    when(notificationRepository.insertRows(any()))
        .thenReturn(new OrganizationProvisioningCompletedInAppNotificationRepositoryResult(1, 1, 0));

    OrganizationProvisioningCompletedInAppNotificationInsertResult result =
        executor.insertNotifications(acceptedClaim(), readyInsertPlan());

    assertThat(result.accepted()).isTrue();
    assertThat(result.duplicate()).isFalse();
    assertThat(result.insertAttempted()).isTrue();
    assertThat(result.insertExecuted()).isTrue();
    assertThat(result.dbWriteExecuted()).isTrue();
    assertThat(result.markSuccessExecuted()).isFalse();
    assertThat(result.markFailureExecuted()).isFalse();
    assertThat(result.requestedRows()).isEqualTo(1);
    assertThat(result.insertedRows()).isEqualTo(1);
    assertThat(result.duplicateRows()).isZero();
    assertThat(result.reason()).isEqualTo("inserted_mark_success_deferred");
    assertThat(result.status()).isEqualTo("inserted");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<OrganizationProvisioningCompletedInAppNotificationInsertRow>> rowsCaptor =
        ArgumentCaptor.forClass(List.class);
    verify(notificationRepository).insertRows(rowsCaptor.capture());
    assertThat(rowsCaptor.getValue())
        .hasSize(1)
        .first()
        .satisfies(
            row -> {
              assertThat(row.eventId()).isEqualTo("evt_notification_31:in_app");
              assertThat(row.idempotencyKey())
                  .isEqualTo("organization-provisioning-completed-provider:31:in_app:1001");
              assertThat(row.recipientCenterUserId()).isEqualTo(1001L);
              assertThat(row.targetCustomerId()).isEqualTo("org001");
              assertThat(row.targetDbName()).isEqualTo("tenant_org001");
              assertThat(row.templateKey())
                  .isEqualTo(OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
              assertThat(row.title()).isEqualTo("组织空间开通完成");
              assertThat(row.content()).isEqualTo("您的组织空间已开通完成，请刷新后进入新空间。");
              assertThat(row.status()).isEqualTo("unread");
              assertThat(row.payloadJson()).contains("\"jobId\":31");
            });
  }

  @Test
  void insertNotificationsTreatsAllDuplicateRowsAsDuplicateResult() {
    appProperties.getRabbitMq().setOrganizationProvisioningInAppNotificationInsertEnabled(true);
    when(notificationRepository.insertRows(any()))
        .thenReturn(new OrganizationProvisioningCompletedInAppNotificationRepositoryResult(1, 0, 1));

    OrganizationProvisioningCompletedInAppNotificationInsertResult result =
        executor.insertNotifications(acceptedClaim(), readyInsertPlan());

    assertThat(result.accepted()).isTrue();
    assertThat(result.duplicate()).isTrue();
    assertThat(result.insertAttempted()).isTrue();
    assertThat(result.insertExecuted()).isTrue();
    assertThat(result.dbWriteExecuted()).isTrue();
    assertThat(result.markSuccessExecuted()).isFalse();
    assertThat(result.markFailureExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("already_inserted");
    assertThat(result.status()).isEqualTo("duplicate");
  }

  @Test
  void markSuccessReturnsBlockedWhenClaimWasNotAccepted() {
    OrganizationProvisioningCompletedInAppProviderMarkSuccessResult result =
        executor.markSuccess(null, acceptedInsert());

    assertThat(result.accepted()).isFalse();
    assertThat(result.markSuccessAttempted()).isFalse();
    assertThat(result.markSuccessExecuted()).isFalse();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.websocketExecuted()).isFalse();
    assertThat(result.pushExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("claim_not_accepted");
    assertThat(result.status()).isEqualTo("blocked");
    verify(eventConsumeLogRepository, never()).markSuccess(any());
  }

  @Test
  void markSuccessReturnsBlockedWhenInsertWasNotAccepted() {
    OrganizationProvisioningCompletedInAppProviderMarkSuccessResult result =
        executor.markSuccess(acceptedClaim(), null);

    assertThat(result.accepted()).isFalse();
    assertThat(result.markSuccessAttempted()).isFalse();
    assertThat(result.markSuccessExecuted()).isFalse();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("insert_not_accepted");
    assertThat(result.status()).isEqualTo("blocked");
    verify(eventConsumeLogRepository, never()).markSuccess(any());
  }

  @Test
  void markSuccessReturnsDryRunWhenGateIsDisabled() {
    OrganizationProvisioningCompletedInAppProviderMarkSuccessResult result =
        executor.markSuccess(acceptedClaim(), acceptedInsert());

    assertThat(result.accepted()).isFalse();
    assertThat(result.markSuccessAttempted()).isFalse();
    assertThat(result.markSuccessExecuted()).isFalse();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.websocketExecuted()).isFalse();
    assertThat(result.pushExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("mark_success_gate_disabled");
    assertThat(result.status()).isEqualTo("dry_run");
    verify(eventConsumeLogRepository, never()).markSuccess(any());
  }

  @Test
  void markSuccessUpdatesConsumeLogWhenGateIsEnabled() {
    appProperties.getRabbitMq().setOrganizationProvisioningInAppProviderMarkSuccessEnabled(true);

    OrganizationProvisioningCompletedInAppProviderMarkSuccessResult result =
        executor.markSuccess(acceptedClaim(), acceptedInsert());

    assertThat(result.accepted()).isTrue();
    assertThat(result.markSuccessAttempted()).isTrue();
    assertThat(result.markSuccessExecuted()).isTrue();
    assertThat(result.dbWriteExecuted()).isTrue();
    assertThat(result.websocketExecuted()).isFalse();
    assertThat(result.pushExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("provider_consume_log_marked_success");
    assertThat(result.status()).isEqualTo("success");

    ArgumentCaptor<EventConsumeLogEntry> entryCaptor =
        ArgumentCaptor.forClass(EventConsumeLogEntry.class);
    verify(eventConsumeLogRepository).markSuccess(entryCaptor.capture());
    assertThat(entryCaptor.getValue())
        .extracting(
            EventConsumeLogEntry::consumerGroup,
            EventConsumeLogEntry::eventId,
            EventConsumeLogEntry::eventType,
            EventConsumeLogEntry::idempotencyKey,
            EventConsumeLogEntry::topic)
        .containsExactly(
            "provider-in-app-organization-provisioning-completed",
            "evt_notification_31:in_app",
            "provider.organization.provisioning.completed.in_app_notification",
            "organization-provisioning-completed-provider:31:in_app",
            "magic.notification.queue");
  }

  @Test
  void markFailureReturnsBlockedWhenClaimWasNotAccepted() {
    OrganizationProvisioningCompletedInAppProviderMarkFailureResult result =
        executor.markFailure(null, "insert failed");

    assertThat(result.accepted()).isFalse();
    assertThat(result.markFailureAttempted()).isFalse();
    assertThat(result.markFailureExecuted()).isFalse();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.websocketExecuted()).isFalse();
    assertThat(result.pushExecuted()).isFalse();
    assertThat(result.failureReason()).isEqualTo("insert failed");
    assertThat(result.reason()).isEqualTo("claim_not_accepted");
    assertThat(result.status()).isEqualTo("blocked");
    verify(eventConsumeLogRepository, never())
        .markFailure(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void markFailureReturnsBlockedWhenFailureReasonIsMissing() {
    OrganizationProvisioningCompletedInAppProviderMarkFailureResult result =
        executor.markFailure(acceptedClaim(), " ");

    assertThat(result.accepted()).isFalse();
    assertThat(result.markFailureAttempted()).isFalse();
    assertThat(result.markFailureExecuted()).isFalse();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("failure_reason_missing");
    assertThat(result.status()).isEqualTo("blocked");
    verify(eventConsumeLogRepository, never())
        .markFailure(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void markFailureReturnsDryRunWhenGateIsDisabled() {
    OrganizationProvisioningCompletedInAppProviderMarkFailureResult result =
        executor.markFailure(acceptedClaim(), "insert failed");

    assertThat(result.accepted()).isFalse();
    assertThat(result.markFailureAttempted()).isFalse();
    assertThat(result.markFailureExecuted()).isFalse();
    assertThat(result.dbWriteExecuted()).isFalse();
    assertThat(result.websocketExecuted()).isFalse();
    assertThat(result.pushExecuted()).isFalse();
    assertThat(result.failureReason()).isEqualTo("insert failed");
    assertThat(result.reason()).isEqualTo("mark_failure_gate_disabled");
    assertThat(result.status()).isEqualTo("dry_run");
    verify(eventConsumeLogRepository, never())
        .markFailure(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void markFailureUpdatesConsumeLogWhenGateIsEnabled() {
    appProperties.getRabbitMq().setOrganizationProvisioningInAppProviderMarkFailureEnabled(true);

    OrganizationProvisioningCompletedInAppProviderMarkFailureResult result =
        executor.markFailure(acceptedClaim(), " insert failed ");

    assertThat(result.accepted()).isTrue();
    assertThat(result.markFailureAttempted()).isTrue();
    assertThat(result.markFailureExecuted()).isTrue();
    assertThat(result.dbWriteExecuted()).isTrue();
    assertThat(result.websocketExecuted()).isFalse();
    assertThat(result.pushExecuted()).isFalse();
    assertThat(result.failureReason()).isEqualTo("insert failed");
    assertThat(result.reason()).isEqualTo("provider_consume_log_marked_failed");
    assertThat(result.status()).isEqualTo("failed");

    ArgumentCaptor<EventConsumeLogEntry> entryCaptor =
        ArgumentCaptor.forClass(EventConsumeLogEntry.class);
    org.mockito.ArgumentCaptor<String> reasonCaptor =
        org.mockito.ArgumentCaptor.forClass(String.class);
    verify(eventConsumeLogRepository).markFailure(entryCaptor.capture(), reasonCaptor.capture());
    assertThat(reasonCaptor.getValue()).isEqualTo("insert failed");
    assertThat(entryCaptor.getValue())
        .extracting(
            EventConsumeLogEntry::consumerGroup,
            EventConsumeLogEntry::eventId,
            EventConsumeLogEntry::eventType,
            EventConsumeLogEntry::idempotencyKey,
            EventConsumeLogEntry::topic)
        .containsExactly(
            "provider-in-app-organization-provisioning-completed",
            "evt_notification_31:in_app",
            "provider.organization.provisioning.completed.in_app_notification",
            "organization-provisioning-completed-provider:31:in_app",
            "magic.notification.queue");
  }

  private Map<String, Object> readyPreflight() {
    return Map.of(
        "claimReady",
        true,
        "blockedReasons",
        List.of(),
        "consumerGroup",
        "provider-in-app-organization-provisioning-completed",
        "eventId",
        "evt_notification_31:in_app",
        "eventType",
        "provider.organization.provisioning.completed.in_app_notification",
        "idempotencyKey",
        "organization-provisioning-completed-provider:31:in_app",
        "topic",
        "magic.notification.queue");
  }

  private OrganizationProvisioningCompletedInAppProviderClaimResult acceptedClaim() {
    return new OrganizationProvisioningCompletedInAppProviderClaimResult(
        true,
        false,
        true,
        true,
        false,
        false,
        false,
        EventConsumeClaimResult.CLAIMED,
        "claimed_write_deferred",
        "processing",
        readyPreflight());
  }

  private OrganizationProvisioningCompletedInAppNotificationInsertResult acceptedInsert() {
    return new OrganizationProvisioningCompletedInAppNotificationInsertResult(
        true,
        false,
        true,
        true,
        true,
        false,
        false,
        1,
        1,
        0,
        "inserted_mark_success_deferred",
        "inserted",
        readyInsertPlan());
  }

  private Map<String, Object> readyInsertPlan() {
    return Map.of(
        "planStatus",
        "ready_for_insert_dry_run",
        "blockedReasons",
        List.of(),
        "insertRows",
        List.of(
            Map.of(
                "eventId",
                "evt_notification_31:in_app",
                "idempotencyKey",
                "organization-provisioning-completed-provider:31:in_app:1001",
                "recipientCenterUserId",
                1001,
                "targetCustomerId",
                "org001",
                "targetDbName",
                "tenant_org001",
                "templateKey",
                OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY,
                "title",
                "组织空间开通完成",
                "content",
                "您的组织空间已开通完成，请刷新后进入新空间。",
                "status",
                "unread",
                "payloadJsonPreview",
                Map.of(
                    "jobId",
                    31,
                    "recipientScope",
                    "organization_owner",
                    "memberRole",
                    "owner",
                    "channel",
                    "in_app"))));
  }
}

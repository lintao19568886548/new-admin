package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

/** in_app provider 显式手动串联执行测试；确认不接 listener，也不推 websocket/push。 */
class OrganizationProvisioningCompletedInAppProviderManualExecutionServiceTest {

  private OrganizationProvisioningCompletedInAppProviderExecutor executor;
  private OrganizationProvisioningCompletedInAppProviderManualExecutionService service;

  @BeforeEach
  void setUp() {
    executor = org.mockito.Mockito.mock(OrganizationProvisioningCompletedInAppProviderExecutor.class);
    service = new OrganizationProvisioningCompletedInAppProviderManualExecutionService(executor);
  }

  @Test
  void executeBlocksWhenManualPlanIsMissingRequiredNestedPlans() {
    OrganizationProvisioningCompletedInAppProviderManualExecutionResult result =
        service.execute(Map.of("planStatus", "ready_for_write_plan"));

    assertThat(result.manualExecutionRequested()).isTrue();
    assertThat(result.manualExecutionExecuted()).isFalse();
    assertThat(result.manualExecutionCompleted()).isFalse();
    assertThat(result.listenerAutoExecution()).isFalse();
    assertThat(result.websocketExecuted()).isFalse();
    assertThat(result.pushExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("manual_execution_plan_missing");
    assertThat(result.status()).isEqualTo("blocked");
    assertThat(result.executionBoundary())
        .isEqualTo(OrganizationProvisioningCompletedInAppProviderManualExecutionService.EXECUTION_BOUNDARY);
    assertThat(result.claimResult()).isNull();
    assertThat(result.insertResult()).isNull();
    assertThat(result.markSuccessResult()).isNull();
    assertThat(result.markFailureResult()).isNull();
    verify(executor, never()).claim(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void executeStopsAfterClaimWhenClaimIsNotAccepted() {
    OrganizationProvisioningCompletedInAppProviderClaimResult claimResult =
        new OrganizationProvisioningCompletedInAppProviderClaimResult(
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            null,
            "claim_gate_disabled",
            "dry_run",
            preflightPlan());
    when(executor.claim(preflightPlan())).thenReturn(claimResult);

    OrganizationProvisioningCompletedInAppProviderManualExecutionResult result =
        service.execute(inAppExecutionPlan());

    assertThat(result.manualExecutionRequested()).isTrue();
    assertThat(result.manualExecutionExecuted()).isTrue();
    assertThat(result.manualExecutionCompleted()).isFalse();
    assertThat(result.listenerAutoExecution()).isFalse();
    assertThat(result.websocketExecuted()).isFalse();
    assertThat(result.pushExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("claim_gate_disabled");
    assertThat(result.status()).isEqualTo("stopped_after_claim");
    assertThat(result.claimResult()).isSameAs(claimResult);
    assertThat(result.insertResult()).isNull();
    assertThat(result.markSuccessResult()).isNull();
    assertThat(result.markFailureResult()).isNull();
    verify(executor).claim(preflightPlan());
    verify(executor, never())
        .insertNotifications(
            org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    verify(executor, never())
        .markSuccess(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void executeStopsAfterInsertWhenInsertIsNotAccepted() {
    OrganizationProvisioningCompletedInAppProviderClaimResult claimResult = acceptedClaim();
    OrganizationProvisioningCompletedInAppNotificationInsertResult insertResult =
        new OrganizationProvisioningCompletedInAppNotificationInsertResult(
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            1,
            0,
            0,
            "insert_gate_disabled",
            "dry_run",
            notificationInsertPlan());
    when(executor.claim(preflightPlan())).thenReturn(claimResult);
    when(executor.insertNotifications(claimResult, notificationInsertPlan())).thenReturn(insertResult);

    OrganizationProvisioningCompletedInAppProviderManualExecutionResult result =
        service.execute(inAppExecutionPlan());

    assertThat(result.manualExecutionExecuted()).isTrue();
    assertThat(result.manualExecutionCompleted()).isFalse();
    assertThat(result.listenerAutoExecution()).isFalse();
    assertThat(result.websocketExecuted()).isFalse();
    assertThat(result.pushExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("insert_gate_disabled");
    assertThat(result.status()).isEqualTo("stopped_after_insert");
    assertThat(result.claimResult()).isSameAs(claimResult);
    assertThat(result.insertResult()).isSameAs(insertResult);
    assertThat(result.markSuccessResult()).isNull();
    assertThat(result.markFailureResult()).isNull();

    InOrder order = inOrder(executor);
    order.verify(executor).claim(preflightPlan());
    order.verify(executor).insertNotifications(claimResult, notificationInsertPlan());
    verify(executor, never()).markSuccess(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void executeMarksSuccessAfterAcceptedInsert() {
    OrganizationProvisioningCompletedInAppProviderClaimResult claimResult = acceptedClaim();
    OrganizationProvisioningCompletedInAppNotificationInsertResult insertResult = acceptedInsert();
    OrganizationProvisioningCompletedInAppProviderMarkSuccessResult markSuccessResult =
        new OrganizationProvisioningCompletedInAppProviderMarkSuccessResult(
            true,
            true,
            true,
            true,
            false,
            false,
            "provider_consume_log_marked_success",
            "success",
            preflightPlan());
    when(executor.claim(preflightPlan())).thenReturn(claimResult);
    when(executor.insertNotifications(claimResult, notificationInsertPlan())).thenReturn(insertResult);
    when(executor.markSuccess(claimResult, insertResult)).thenReturn(markSuccessResult);

    OrganizationProvisioningCompletedInAppProviderManualExecutionResult result =
        service.execute(inAppExecutionPlan());

    assertThat(result.manualExecutionRequested()).isTrue();
    assertThat(result.manualExecutionExecuted()).isTrue();
    assertThat(result.manualExecutionCompleted()).isTrue();
    assertThat(result.listenerAutoExecution()).isFalse();
    assertThat(result.websocketExecuted()).isFalse();
    assertThat(result.pushExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("provider_consume_log_marked_success");
    assertThat(result.status()).isEqualTo("success");
    assertThat(result.claimResult()).isSameAs(claimResult);
    assertThat(result.insertResult()).isSameAs(insertResult);
    assertThat(result.markSuccessResult()).isSameAs(markSuccessResult);
    assertThat(result.markFailureResult()).isNull();

    InOrder order = inOrder(executor);
    order.verify(executor).claim(preflightPlan());
    order.verify(executor).insertNotifications(claimResult, notificationInsertPlan());
    order.verify(executor).markSuccess(claimResult, insertResult);
  }

  @Test
  void executeMarksFailureWhenInsertThrowsAfterClaim() {
    OrganizationProvisioningCompletedInAppProviderClaimResult claimResult = acceptedClaim();
    OrganizationProvisioningCompletedInAppProviderMarkFailureResult markFailureResult =
        acceptedMarkFailure("in_app provider manual execution failed at insertNotifications: db down");
    when(executor.claim(preflightPlan())).thenReturn(claimResult);
    when(executor.insertNotifications(claimResult, notificationInsertPlan()))
        .thenThrow(new IllegalStateException("db down"));
    when(executor.markFailure(
            claimResult,
            "in_app provider manual execution failed at insertNotifications: db down"))
        .thenReturn(markFailureResult);

    OrganizationProvisioningCompletedInAppProviderManualExecutionResult result =
        service.execute(inAppExecutionPlan());

    assertThat(result.manualExecutionExecuted()).isTrue();
    assertThat(result.manualExecutionCompleted()).isFalse();
    assertThat(result.listenerAutoExecution()).isFalse();
    assertThat(result.websocketExecuted()).isFalse();
    assertThat(result.pushExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("insert_exception_mark_failure_attempted");
    assertThat(result.status()).isEqualTo("failed");
    assertThat(result.claimResult()).isSameAs(claimResult);
    assertThat(result.insertResult()).isNull();
    assertThat(result.markSuccessResult()).isNull();
    assertThat(result.markFailureResult()).isSameAs(markFailureResult);

    InOrder order = inOrder(executor);
    order.verify(executor).claim(preflightPlan());
    order.verify(executor).insertNotifications(claimResult, notificationInsertPlan());
    order.verify(executor)
        .markFailure(
            claimResult,
            "in_app provider manual execution failed at insertNotifications: db down");
    verify(executor, never()).markSuccess(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    verifyNoMoreInteractions(executor);
  }

  @Test
  void executeMarksFailureWhenMarkSuccessThrowsAfterInsert() {
    OrganizationProvisioningCompletedInAppProviderClaimResult claimResult = acceptedClaim();
    OrganizationProvisioningCompletedInAppNotificationInsertResult insertResult = acceptedInsert();
    OrganizationProvisioningCompletedInAppProviderMarkFailureResult markFailureResult =
        acceptedMarkFailure("in_app provider manual execution failed at markSuccess: update failed");
    when(executor.claim(preflightPlan())).thenReturn(claimResult);
    when(executor.insertNotifications(claimResult, notificationInsertPlan())).thenReturn(insertResult);
    when(executor.markSuccess(claimResult, insertResult))
        .thenThrow(new IllegalStateException("update failed"));
    when(executor.markFailure(
            claimResult,
            "in_app provider manual execution failed at markSuccess: update failed"))
        .thenReturn(markFailureResult);

    OrganizationProvisioningCompletedInAppProviderManualExecutionResult result =
        service.execute(inAppExecutionPlan());

    assertThat(result.manualExecutionExecuted()).isTrue();
    assertThat(result.manualExecutionCompleted()).isFalse();
    assertThat(result.listenerAutoExecution()).isFalse();
    assertThat(result.websocketExecuted()).isFalse();
    assertThat(result.pushExecuted()).isFalse();
    assertThat(result.reason()).isEqualTo("mark_success_exception_mark_failure_attempted");
    assertThat(result.status()).isEqualTo("failed");
    assertThat(result.claimResult()).isSameAs(claimResult);
    assertThat(result.insertResult()).isSameAs(insertResult);
    assertThat(result.markSuccessResult()).isNull();
    assertThat(result.markFailureResult()).isSameAs(markFailureResult);

    InOrder order = inOrder(executor);
    order.verify(executor).claim(preflightPlan());
    order.verify(executor).insertNotifications(claimResult, notificationInsertPlan());
    order.verify(executor).markSuccess(claimResult, insertResult);
    order.verify(executor)
        .markFailure(
            claimResult,
            "in_app provider manual execution failed at markSuccess: update failed");
    verifyNoMoreInteractions(executor);
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
        preflightPlan());
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
        notificationInsertPlan());
  }

  private OrganizationProvisioningCompletedInAppProviderMarkFailureResult acceptedMarkFailure(
      String failureReason) {
    return new OrganizationProvisioningCompletedInAppProviderMarkFailureResult(
        true,
        true,
        true,
        true,
        false,
        false,
        failureReason,
        "provider_consume_log_marked_failed",
        "failed",
        preflightPlan());
  }

  private Map<String, Object> inAppExecutionPlan() {
    return Map.of(
        "executorPreflightPlan",
        preflightPlan(),
        "writePreview",
        Map.of("notificationInsertPlan", notificationInsertPlan()));
  }

  private Map<String, Object> preflightPlan() {
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

  private Map<String, Object> notificationInsertPlan() {
    return Map.of(
        "planStatus",
        "ready_for_insert_dry_run",
        "blockedReasons",
        List.of(),
        "insertRows",
        List.of(Map.of("recipientCenterUserId", 1001)));
  }
}

package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowDecisionDryRunService decisionService =
      new NotificationInAppProviderBridgeReturnThrowDecisionDryRunService(
          new NotificationInAppProviderConsumerResultClassificationBridgeService(
              new NotificationInAppProviderConsumerResultAdapterService(),
              new NotificationInAppProviderConsumerResultValidationPlanService()),
          new NotificationInAppProviderBridgeReturnThrowPolicyDecisionService());
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService
      payloadService =
          new NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService();
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService
      service = new NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService();

  @Test
  void buildDryRunPlansReadOnlyObservationLoggingWhenPayloadAndGateAreReady() {
    Map<String, Object> payloadPlan = readyPayloadPlan();

    Map<String, Object> plan =
        service.buildDryRun(payloadPlan, Map.of("observationLoggingAllowed", true));

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_log_execution")
        .containsEntry(
            "planStatus", "ready_for_bridge_return_throw_decision_observation_log_dry_run")
        .containsEntry("payloadDryRunPlanProvided", true)
        .containsEntry("payloadBuildExecuted", true)
        .containsEntry("payloadPreviewAvailable", true)
        .containsEntry("observationLoggingAllowed", true)
        .containsEntry(
            "logMessageKey",
            "notification.in_app_provider.bridge_return_throw_decision_dry_run")
        .containsEntry("observationLoggingRequested", true)
        .containsEntry("logPlanned", true)
        .containsEntry(
            "nextAction", "ready_for_future_listener_observation_logging_integration_batch");
    assertThat(logPayloadPreview(plan))
        .containsEntry("eventId", "evt_31")
        .containsEntry("idempotencyKey", "idem_31")
        .containsEntry(
            "logMessageKey",
            "notification.in_app_provider.bridge_return_throw_decision_dry_run");
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertNoSideEffects(plan);
  }

  @Test
  void buildDryRunKeepsObservationLoggingBlockedUntilPayloadAndGateAreReady() {
    Map<String, Object> payloadPlan = readyPayloadPlan();

    assertBlocked(
        service.buildDryRun(payloadPlan, Map.of("observationLoggingAllowed", false)),
        "decision output observation logging gate 尚未 ready");
    assertBlocked(
        service.buildDryRun(
            Map.of("payloadBuildExecuted", false, "payloadPreview", Map.of()),
            Map.of("observationLoggingAllowed", true)),
        "payloadBuildExecuted=false，不能规划 observation logging");
    assertBlocked(
        service.buildDryRun(Map.of(), Map.of("observationLoggingAllowed", true)),
        "payload dry-run plan 缺失，不能规划 observation logging");
  }

  private void assertBlocked(Map<String, Object> plan, String expectedReason) {
    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("observationLoggingRequested", true)
        .containsEntry("observationLoggingExecuted", false)
        .containsEntry("logPlanned", false)
        .containsEntry("logExecuted", false)
        .containsEntry("logPayloadPreview", Map.of())
        .containsEntry(
            "nextAction", "keep_observation_logging_blocked_until_payload_and_gate_ready");
    assertThat(stringList(plan.get("blockedReasons"))).contains(expectedReason);
    assertNoSideEffects(plan);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> logPayloadPreview(Map<String, Object> plan) {
    return (Map<String, Object>) plan.get("logPayloadPreview");
  }

  private void assertNoSideEffects(Map<String, Object> plan) {
    assertThat(plan)
        .containsEntry("observationLoggingExecuted", false)
        .containsEntry("logExecuted", false)
        .containsEntry("databaseWriteExecuted", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("decisionApplied", false)
        .containsEntry("throwRequested", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
  }

  private Map<String, Object> readyPayloadPlan() {
    OrganizationProvisioningCompletedNotificationConsumeResult sourceResult =
        new OrganizationProvisioningCompletedNotificationConsumeResult(
            true,
            false,
            "evt_31",
            "idem_31",
            31,
            blockedStatusSendPlan(),
            true,
            "notification_send_plan_generated",
            "success",
            "org001",
            "tenant_org001");
    Map<String, Object> decisionPlan =
        decisionService.decideDryRun(
            sourceResult, Map.of("returnThrowPolicyChangeAllowed", true));
    return payloadService.buildDryRun(
        sourceResult, decisionPlan, Map.of("observationLoggingAllowed", true));
  }

  private Map<String, Object> blockedStatusSendPlan() {
    Map<String, Object> providerPlan = new LinkedHashMap<>();
    providerPlan.put(
        "inAppExecutionPlan",
        Map.of(
            "planStatus",
            "blocked",
            "listenerAutoExecutionGatePlan",
            Map.of("invocationPlan", Map.of("planStatus", "blocked"))));
    Map<String, Object> sendPlan = new LinkedHashMap<>();
    sendPlan.put("providerPlan", providerPlan);
    return sendPlan;
  }

  private List<String> stringList(Object value) {
    if (value instanceof List<?> list) {
      return list.stream().map(String::valueOf).toList();
    }
    return List.of();
  }
}

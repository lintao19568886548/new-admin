package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowDecisionDryRunService decisionService =
      new NotificationInAppProviderBridgeReturnThrowDecisionDryRunService(
          new NotificationInAppProviderConsumerResultClassificationBridgeService(
              new NotificationInAppProviderConsumerResultAdapterService(),
              new NotificationInAppProviderConsumerResultValidationPlanService()),
          new NotificationInAppProviderBridgeReturnThrowPolicyDecisionService());
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService
      service =
          new NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService();

  @Test
  void buildDryRunConstructsPayloadPreviewWhenLoggingGateIsReady() {
    OrganizationProvisioningCompletedNotificationConsumeResult sourceResult =
        success(blockedStatusSendPlan());
    Map<String, Object> decisionPlan =
        decisionService.decideDryRun(
            sourceResult, Map.of("returnThrowPolicyChangeAllowed", true));

    Map<String, Object> plan =
        service.buildDryRun(sourceResult, decisionPlan, Map.of("observationLoggingAllowed", true));

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_log_payload_construction")
        .containsEntry(
            "planStatus",
            "ready_for_bridge_return_throw_decision_observation_log_payload_dry_run")
        .containsEntry("sourceResultProvided", true)
        .containsEntry("decisionOutputObservationPlanAvailable", true)
        .containsEntry("observationLoggingAllowed", true)
        .containsEntry("payloadBuildRequested", true)
        .containsEntry("payloadBuildExecuted", true)
        .containsEntry(
            "nextAction", "ready_for_future_listener_observation_payload_logging_batch");
    assertThat(payloadPreview(plan))
        .containsEntry("eventId", "evt_31")
        .containsEntry("idempotencyKey", "idem_31")
        .containsEntry(
            "logMessageKey",
            "notification.in_app_provider.bridge_return_throw_decision_dry_run");
    assertThat(bridgeResultPayload(plan))
        .containsEntry("classificationStatus", "blocked")
        .containsEntry("futureReturnThrowDecision", "throw_for_retry_or_dlq_until_real_policy_batch");
    assertThat(policyDecisionPayload(plan))
        .containsEntry("planStatus", "ready_for_bridge_return_throw_policy_decision_dry_run")
        .containsEntry("futureListenerDecision", "throw_for_retry_or_dlq_until_real_policy_batch")
        .containsEntry("decisionApplied", false);
    assertThat(stringList(payloadPreview(plan).get("blockedReasons"))).isEmpty();
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertNoSideEffects(plan);
  }

  @Test
  void buildDryRunKeepsPayloadBlockedUntilGateAndInputsAreReady() {
    Map<String, Object> readyDecisionPlan =
        decisionService.decideDryRun(
            success(blockedStatusSendPlan()), Map.of("returnThrowPolicyChangeAllowed", true));

    assertBlocked(
        service.buildDryRun(
            success(blockedStatusSendPlan()),
            readyDecisionPlan,
            Map.of("observationLoggingAllowed", false)),
        "decision output observation logging gate 尚未 ready");
    assertBlocked(
        service.buildDryRun(null, readyDecisionPlan, Map.of("observationLoggingAllowed", true)),
        "source result 缺失，不能构造 observation log payload");
    assertBlocked(
        service.buildDryRun(
            success(blockedStatusSendPlan()),
            Map.of("bridgeResult", Map.of()),
            Map.of("observationLoggingAllowed", true)),
        "decisionOutputObservationPlan 缺失，不能构造 observation log payload");
  }

  private void assertBlocked(Map<String, Object> plan, String expectedReason) {
    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("payloadBuildRequested", true)
        .containsEntry("payloadBuildExecuted", false)
        .containsEntry("payloadPreview", Map.of())
        .containsEntry(
            "nextAction", "keep_observation_log_payload_construction_blocked_until_gate_ready");
    assertThat(stringList(plan.get("blockedReasons"))).contains(expectedReason);
    assertNoSideEffects(plan);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> payloadPreview(Map<String, Object> plan) {
    return (Map<String, Object>) plan.get("payloadPreview");
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> bridgeResultPayload(Map<String, Object> plan) {
    return (Map<String, Object>) payloadPreview(plan).get("bridgeResult");
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> policyDecisionPayload(Map<String, Object> plan) {
    return (Map<String, Object>) payloadPreview(plan).get("policyDecisionPlan");
  }

  private void assertNoSideEffects(Map<String, Object> plan) {
    assertThat(plan)
        .containsEntry("payloadWritten", false)
        .containsEntry("logExecuted", false)
        .containsEntry("databaseWriteExecuted", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("decisionApplied", false)
        .containsEntry("throwRequested", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
  }

  private OrganizationProvisioningCompletedNotificationConsumeResult success(
      Map<String, Object> sendPlan) {
    return new OrganizationProvisioningCompletedNotificationConsumeResult(
        true,
        false,
        "evt_31",
        "idem_31",
        31,
        sendPlan,
        true,
        "notification_send_plan_generated",
        "success",
        "org001",
        "tenant_org001");
  }

  private Map<String, Object> blockedStatusSendPlan() {
    return sendPlan(
        Map.of(
            "planStatus",
            "blocked",
            "listenerAutoExecutionGatePlan",
            Map.of("invocationPlan", Map.of("planStatus", "blocked"))));
  }

  private Map<String, Object> sendPlan(Map<String, Object> inAppExecutionPlan) {
    Map<String, Object> providerPlan = new LinkedHashMap<>();
    providerPlan.put("inAppExecutionPlan", inAppExecutionPlan);
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

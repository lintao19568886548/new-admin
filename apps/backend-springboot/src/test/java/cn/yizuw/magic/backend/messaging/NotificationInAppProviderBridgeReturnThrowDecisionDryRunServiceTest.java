package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NotificationInAppProviderBridgeReturnThrowDecisionDryRunServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowDecisionDryRunService service =
      new NotificationInAppProviderBridgeReturnThrowDecisionDryRunService(
          new NotificationInAppProviderConsumerResultClassificationBridgeService(
              new NotificationInAppProviderConsumerResultAdapterService(),
              new NotificationInAppProviderConsumerResultValidationPlanService()),
          new NotificationInAppProviderBridgeReturnThrowPolicyDecisionService());

  @Test
  void decideDryRunKeepsCompositionBlockedWhenPolicyGateIsBlocked() {
    Map<String, Object> plan =
        service.decideDryRun(
            success(readySendPlan()), Map.of("returnThrowPolicyChangeAllowed", false));

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_composition")
        .containsEntry("planStatus", "blocked")
        .containsEntry("sourceResultProvided", true)
        .containsEntry("bridgeBean", "notificationInAppProviderConsumerResultClassificationBridgeService")
        .containsEntry("bridgeMethod", "classifyDryRun")
        .containsEntry(
            "policyDecisionBean", "notificationInAppProviderBridgeReturnThrowPolicyDecisionService")
        .containsEntry("policyDecisionMethod", "decideDryRun")
        .containsEntry("bridgeDryRunExecuted", true)
        .containsEntry("policyDecisionDryRunExecuted", true)
        .containsEntry(
            "nextAction",
            "keep_listener_return_throw_decision_blocked_until_bridge_and_policy_gate_ready");
    assertThat(bridgeResult(plan))
        .containsEntry("futureReturnThrowDecision", "return_deferred_until_manual_execution_result_is_verified");
    assertThat(policyDecisionPlan(plan))
        .containsEntry("futureListenerDecision", "keep_current_listener_return_policy")
        .containsEntry("decisionApplied", false);
    assertThat(stringList(plan.get("blockedReasons")))
        .containsExactly(
            "bridge return/throw policy gate 尚未 ready，不能应用 bridge return/throw 决策");
    assertNoSideEffects(plan);
  }

  @Test
  void decideDryRunComposesBridgeFutureThrowDecisionWhenPolicyGateIsReady() {
    Map<String, Object> plan =
        service.decideDryRun(
            success(blockedStatusSendPlan()), Map.of("returnThrowPolicyChangeAllowed", true));

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_listener_return_throw_decision_dry_run")
        .containsEntry("sourceResultProvided", true)
        .containsEntry("bridgeDryRunExecuted", true)
        .containsEntry("policyDecisionDryRunExecuted", true)
        .containsEntry("nextAction", "ready_for_future_listener_read_only_decision_invocation_batch");
    assertThat(bridgeResult(plan))
        .containsEntry("classificationStatus", "blocked")
        .containsEntry("futureReturnThrowDecision", "throw_for_retry_or_dlq_until_real_policy_batch");
    assertThat(policyDecisionPlan(plan))
        .containsEntry("futureListenerDecision", "throw_for_retry_or_dlq_until_real_policy_batch")
        .containsEntry("decisionRequested", true)
        .containsEntry("decisionApplied", false);
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertNoSideEffects(plan);
  }

  @Test
  void decideDryRunKeepsListenerAndRabbitSideEffectsDisabledForEveryOutcome() {
    assertNoSideEffects(
        service.decideDryRun(
            success(readySendPlan()), Map.of("returnThrowPolicyChangeAllowed", true)));
    assertNoSideEffects(
        service.decideDryRun(
            success(blockedStatusSendPlan()), Map.of("returnThrowPolicyChangeAllowed", true)));
    assertNoSideEffects(
        service.decideDryRun(null, Map.of("returnThrowPolicyChangeAllowed", false)));
  }

  @Test
  void decideDryRunIncludesReadOnlyDecisionOutputObservationPlan() {
    Map<String, Object> plan =
        service.decideDryRun(
            success(blockedStatusSendPlan()), Map.of("returnThrowPolicyChangeAllowed", true));

    Map<String, Object> observationPlan = decisionOutputObservationPlan(plan);
    assertThat(observationPlan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_output_observation")
        .containsEntry(
            "planStatus",
            "ready_for_bridge_return_throw_decision_output_observation_dry_run")
        .containsEntry("decisionOutputAvailable", true)
        .containsEntry(
            "logMessageKey",
            "notification.in_app_provider.bridge_return_throw_decision_dry_run")
        .containsEntry("observationRequested", false)
        .containsEntry("observationExecuted", false)
        .containsEntry("logPlanned", true)
        .containsEntry("logExecuted", false)
        .containsEntry("databaseWriteExecuted", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("decisionApplied", false)
        .containsEntry("throwRequested", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry(
            "nextAction",
            "ready_for_future_bridge_return_throw_decision_observation_logging_batch");
    assertThat(stringList(observationPlan.get("observedFields")))
        .containsExactly(
            "bridgeResult.classificationStatus",
            "bridgeResult.futureReturnThrowDecision",
            "policyDecisionPlan.planStatus",
            "policyDecisionPlan.futureListenerDecision",
            "policyDecisionPlan.decisionApplied",
            "blockedReasons");
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> bridgeResult(Map<String, Object> plan) {
    return (Map<String, Object>) plan.get("bridgeResult");
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> policyDecisionPlan(Map<String, Object> plan) {
    return (Map<String, Object>) plan.get("policyDecisionPlan");
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> decisionOutputObservationPlan(Map<String, Object> plan) {
    return (Map<String, Object>) plan.get("decisionOutputObservationPlan");
  }

  private void assertNoSideEffects(Map<String, Object> plan) {
    assertThat(plan)
        .containsEntry("listenerInvoked", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("decisionApplied", false)
        .containsEntry("throwRequested", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("manualExecutionExecuted", false)
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

  private Map<String, Object> readySendPlan() {
    return sendPlan(
        Map.of(
            "planStatus",
            "ready_for_write_plan",
            "listenerAutoExecutionGatePlan",
            Map.of("invocationPlan", Map.of("planStatus", "ready_for_invocation_dry_run"))));
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

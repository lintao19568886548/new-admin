package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NotificationInAppProviderBridgeReturnThrowPolicyDecisionServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowPolicyDecisionService service =
      new NotificationInAppProviderBridgeReturnThrowPolicyDecisionService();

  @Test
  void decideDryRunKeepsCurrentListenerPolicyWhenPolicyGateIsBlocked() {
    Map<String, Object> plan =
        service.decideDryRun(
            bridgeResult("throw_for_retry_or_dlq_until_real_policy_batch"),
            Map.of("returnThrowPolicyChangeAllowed", false));

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_policy_decision")
        .containsEntry("planStatus", "blocked")
        .containsEntry("bridgeResultProvided", true)
        .containsEntry("policyGateProvided", true)
        .containsEntry("returnThrowPolicyChangeAllowed", false)
        .containsEntry(
            "futureReturnThrowDecision", "throw_for_retry_or_dlq_until_real_policy_batch")
        .containsEntry("currentListenerDecision", "keep_current_listener_return_policy")
        .containsEntry("futureListenerDecision", "keep_current_listener_return_policy")
        .containsEntry("decisionRequested", false)
        .containsEntry(
            "nextAction", "keep_bridge_return_throw_policy_decision_blocked_until_gate_ready");
    assertThat(stringList(plan.get("blockedReasons")))
        .containsExactly(
            "bridge return/throw policy gate 尚未 ready，不能应用 bridge return/throw 决策");
    assertDecisionObservationPlan(plan, "blocked", false);
    assertNoSideEffects(plan);
  }

  @Test
  void decideDryRunMapsFutureThrowDecisionWhenPolicyGateIsReadyWithoutApplyingIt() {
    Map<String, Object> plan =
        service.decideDryRun(
            bridgeResult("throw_for_retry_or_dlq_until_real_policy_batch"),
            Map.of("returnThrowPolicyChangeAllowed", true));

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_bridge_return_throw_policy_decision_dry_run")
        .containsEntry("bridgeResultProvided", true)
        .containsEntry("returnThrowPolicyChangeAllowed", true)
        .containsEntry("classificationStatus", "blocked")
        .containsEntry(
            "futureReturnThrowDecision", "throw_for_retry_or_dlq_until_real_policy_batch")
        .containsEntry("currentListenerDecision", "keep_current_listener_return_policy")
        .containsEntry(
            "futureListenerDecision", "throw_for_retry_or_dlq_until_real_policy_batch")
        .containsEntry("decisionRequested", true)
        .containsEntry(
            "nextAction",
            "ready_for_future_listener_return_throw_policy_switch_implementation_batch");
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertDecisionObservationPlan(
        plan, "ready_for_bridge_return_throw_decision_observation_dry_run", true);
    assertNoSideEffects(plan);
  }

  @Test
  void decideDryRunBlocksWhenBridgeResultIsMissingEvenIfPolicyGateIsReady() {
    Map<String, Object> plan =
        service.decideDryRun(null, Map.of("returnThrowPolicyChangeAllowed", true));

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("bridgeResultProvided", false)
        .containsEntry("returnThrowPolicyChangeAllowed", true)
        .containsEntry(
            "futureReturnThrowDecision",
            "keep_current_listener_return_policy_until_bridge_result_available")
        .containsEntry("futureListenerDecision", "keep_current_listener_return_policy")
        .containsEntry("decisionRequested", false);
    assertThat(stringList(plan.get("blockedReasons")))
        .containsExactly("bridge result 缺失，不能规划 listener return/throw 决策");
    assertDecisionObservationPlan(plan, "blocked", false);
    assertNoSideEffects(plan);
  }

  private Map<String, Object> bridgeResult(String futureReturnThrowDecision) {
    return Map.of(
        "classificationStatus",
        "blocked",
        "futureReturnThrowDecision",
        futureReturnThrowDecision,
        "rabbitAckExecuted",
        false,
        "rabbitNackExecuted",
        false);
  }

  private void assertNoSideEffects(Map<String, Object> plan) {
    assertThat(plan)
        .containsEntry("decisionApplied", false)
        .containsEntry("throwRequested", false)
        .containsEntry("listenerInvoked", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
  }

  @SuppressWarnings("unchecked")
  private void assertDecisionObservationPlan(
      Map<String, Object> plan, String expectedPlanStatus, boolean expectedDecisionReady) {
    Map<String, Object> observationPlan =
        (Map<String, Object>) plan.get("decisionObservationPlan");
    assertThat(observationPlan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_policy_decision_observation")
        .containsEntry("planStatus", expectedPlanStatus)
        .containsEntry("decisionReady", expectedDecisionReady)
        .containsEntry(
            "logMessageKey", "notification.in_app_provider.bridge_return_throw_decision_dry_run")
        .containsEntry("observationRequested", false)
        .containsEntry("observationExecuted", false)
        .containsEntry("logPlanned", expectedDecisionReady)
        .containsEntry("logExecuted", false)
        .containsEntry("databaseWriteExecuted", false)
        .containsEntry("decisionApplied", false)
        .containsEntry("throwRequested", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
    assertThat(stringList(observationPlan.get("observedFields")))
        .containsExactly(
            "classificationStatus",
            "futureReturnThrowDecision",
            "currentListenerDecision",
            "futureListenerDecision",
            "decisionRequested",
            "blockedReasons");
  }

  private List<String> stringList(Object value) {
    if (value instanceof List<?> list) {
      return list.stream().map(String::valueOf).toList();
    }
    return List.of();
  }
}

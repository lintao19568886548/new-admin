package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** bridge result 到 listener return/throw 策略的独立 dry-run 决策适配；不接 listener。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowPolicyDecisionService {

  private static final String CURRENT_LISTENER_DECISION = "keep_current_listener_return_policy";
  private static final String MISSING_BRIDGE_RESULT_DECISION =
      "keep_current_listener_return_policy_until_bridge_result_available";

  public Map<String, Object> decideDryRun(
      Map<String, Object> bridgeResult, Map<String, Object> policyGatePlan) {
    Map<String, Object> bridgeResultMap = mapValue(bridgeResult);
    Map<String, Object> policyGateMap = mapValue(policyGatePlan);
    boolean bridgeResultProvided = !bridgeResultMap.isEmpty();
    boolean policyGateReady =
        Boolean.TRUE.equals(policyGateMap.get("returnThrowPolicyChangeAllowed"));
    boolean ready = bridgeResultProvided && policyGateReady;
    String futureReturnThrowDecision =
        stringValue(
            bridgeResultMap.get("futureReturnThrowDecision"), MISSING_BRIDGE_RESULT_DECISION);

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_policy_decision");
    plan.put(
        "planStatus",
        ready ? "ready_for_bridge_return_throw_policy_decision_dry_run" : "blocked");
    plan.put("bridgeResultProvided", bridgeResultProvided);
    plan.put("policyGateProvided", !policyGateMap.isEmpty());
    plan.put("returnThrowPolicyChangeAllowed", policyGateReady);
    plan.put("classificationStatus", bridgeResultMap.get("classificationStatus"));
    plan.put("futureReturnThrowDecision", futureReturnThrowDecision);
    plan.put("currentListenerDecision", CURRENT_LISTENER_DECISION);
    plan.put(
        "futureListenerDecision",
        ready ? futureReturnThrowDecision : CURRENT_LISTENER_DECISION);
    plan.put("decisionRequested", ready);
    plan.put("decisionApplied", false);
    plan.put("throwRequested", false);
    plan.put("listenerInvoked", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("manualExecutionExecuted", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("blockedReasons", blockedReasons(bridgeResultProvided, policyGateReady));
    plan.put("decisionObservationPlan", decisionObservationPlan(ready));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_listener_return_throw_policy_switch_implementation_batch"
            : "keep_bridge_return_throw_policy_decision_blocked_until_gate_ready");
    return plan;
  }

  private List<String> blockedReasons(boolean bridgeResultProvided, boolean policyGateReady) {
    List<String> reasons = new ArrayList<>();
    if (!bridgeResultProvided) {
      reasons.add("bridge result 缺失，不能规划 listener return/throw 决策");
    }
    if (!policyGateReady) {
      reasons.add("bridge return/throw policy gate 尚未 ready，不能应用 bridge return/throw 决策");
    }
    return reasons;
  }

  private Map<String, Object> decisionObservationPlan(boolean decisionReady) {
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_policy_decision_observation");
    plan.put(
        "planStatus",
        decisionReady ? "ready_for_bridge_return_throw_decision_observation_dry_run" : "blocked");
    plan.put("decisionReady", decisionReady);
    plan.put(
        "observedFields",
        List.of(
            "classificationStatus",
            "futureReturnThrowDecision",
            "currentListenerDecision",
            "futureListenerDecision",
            "decisionRequested",
            "blockedReasons"));
    plan.put("logMessageKey", "notification.in_app_provider.bridge_return_throw_decision_dry_run");
    plan.put("observationRequested", false);
    plan.put("observationExecuted", false);
    plan.put("logPlanned", decisionReady);
    plan.put("logExecuted", false);
    plan.put("databaseWriteExecuted", false);
    plan.put("decisionApplied", false);
    plan.put("throwRequested", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    return plan;
  }

  private Map<String, Object> mapValue(Map<String, Object> value) {
    return value == null ? Map.of() : value;
  }

  private String stringValue(Object value, String fallback) {
    return value == null ? fallback : String.valueOf(value);
  }
}

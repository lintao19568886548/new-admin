package cn.yizuw.magic.backend.messaging;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** bridge classify 到 return/throw policy decision 的独立组合 dry-run；不接 listener。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowDecisionDryRunService {

  private final NotificationInAppProviderConsumerResultClassificationBridgeService
      classificationBridgeService;
  private final NotificationInAppProviderBridgeReturnThrowPolicyDecisionService
      policyDecisionService;

  public NotificationInAppProviderBridgeReturnThrowDecisionDryRunService(
      NotificationInAppProviderConsumerResultClassificationBridgeService classificationBridgeService,
      NotificationInAppProviderBridgeReturnThrowPolicyDecisionService policyDecisionService) {
    this.classificationBridgeService = classificationBridgeService;
    this.policyDecisionService = policyDecisionService;
  }

  public Map<String, Object> decideDryRun(
      OrganizationProvisioningCompletedNotificationConsumeResult sourceResult,
      Map<String, Object> policyGatePlan) {
    Map<String, Object> bridgeResult = classificationBridgeService.classifyDryRun(sourceResult);
    Map<String, Object> decisionPlan =
        policyDecisionService.decideDryRun(bridgeResult, policyGatePlan);
    boolean decisionReady =
        "ready_for_bridge_return_throw_policy_decision_dry_run"
            .equals(decisionPlan.get("planStatus"));

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_composition");
    plan.put(
        "planStatus",
        decisionReady ? "ready_for_listener_return_throw_decision_dry_run" : "blocked");
    plan.put("sourceResultType", "OrganizationProvisioningCompletedNotificationConsumeResult");
    plan.put("sourceResultProvided", sourceResult != null);
    plan.put("bridgeBean", "notificationInAppProviderConsumerResultClassificationBridgeService");
    plan.put("bridgeMethod", "classifyDryRun");
    plan.put("policyDecisionBean", "notificationInAppProviderBridgeReturnThrowPolicyDecisionService");
    plan.put("policyDecisionMethod", "decideDryRun");
    plan.put("bridgeResult", bridgeResult);
    plan.put("policyDecisionPlan", decisionPlan);
    plan.put("bridgeDryRunExecuted", true);
    plan.put("policyDecisionDryRunExecuted", true);
    plan.put("decisionOutputObservationPlan", decisionOutputObservationPlan(decisionPlan));
    plan.put("listenerInvoked", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("decisionApplied", false);
    plan.put("throwRequested", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("manualExecutionExecuted", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("blockedReasons", blockedReasons(decisionPlan));
    plan.put(
        "nextAction",
        decisionReady
            ? "ready_for_future_listener_read_only_decision_invocation_batch"
            : "keep_listener_return_throw_decision_blocked_until_bridge_and_policy_gate_ready");
    return plan;
  }

  private Map<String, Object> decisionOutputObservationPlan(
      Map<String, Object> decisionPlan) {
    boolean ready = decisionPlan != null && !decisionPlan.isEmpty();
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_output_observation");
    plan.put(
        "planStatus",
        ready
            ? "ready_for_bridge_return_throw_decision_output_observation_dry_run"
            : "blocked");
    plan.put("decisionOutputAvailable", ready);
    plan.put(
        "observedFields",
        List.of(
            "bridgeResult.classificationStatus",
            "bridgeResult.futureReturnThrowDecision",
            "policyDecisionPlan.planStatus",
            "policyDecisionPlan.futureListenerDecision",
            "policyDecisionPlan.decisionApplied",
            "blockedReasons"));
    plan.put("logMessageKey", "notification.in_app_provider.bridge_return_throw_decision_dry_run");
    plan.put("observationRequested", false);
    plan.put("observationExecuted", false);
    plan.put("logPlanned", ready);
    plan.put("logExecuted", false);
    plan.put("databaseWriteExecuted", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("decisionApplied", false);
    plan.put("throwRequested", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_bridge_return_throw_decision_observation_logging_batch"
            : "keep_decision_output_observation_blocked_until_decision_plan_available");
    return plan;
  }

  private List<String> blockedReasons(Map<String, Object> decisionPlan) {
    Object value = decisionPlan.get("blockedReasons");
    if (value instanceof List<?> list) {
      return list.stream().map(String::valueOf).toList();
    }
    return List.of();
  }
}

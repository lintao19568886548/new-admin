package cn.yizuw.magic.backend.messaging;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 组合 dry-run 输出 observation log 的 payload 构造 dry-run；不写日志或数据库。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService {

  public Map<String, Object> buildDryRun(
      OrganizationProvisioningCompletedNotificationConsumeResult sourceResult,
      Map<String, Object> decisionDryRunPlan,
      Map<String, Object> loggingGatePlan) {
    Map<String, Object> observationPlan =
        mapValue(mapValue(decisionDryRunPlan).get("decisionOutputObservationPlan"));
    boolean loggingAllowed =
        Boolean.TRUE.equals(mapValue(loggingGatePlan).get("observationLoggingAllowed"));
    boolean observationPlanAvailable = !observationPlan.isEmpty();
    boolean ready = sourceResult != null && loggingAllowed && observationPlanAvailable;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_log_payload_construction");
    plan.put(
        "planStatus",
        ready
            ? "ready_for_bridge_return_throw_decision_observation_log_payload_dry_run"
            : "blocked");
    plan.put("sourceResultProvided", sourceResult != null);
    plan.put("decisionOutputObservationPlanAvailable", observationPlanAvailable);
    plan.put("observationLoggingAllowed", loggingAllowed);
    plan.put("payloadBuildRequested", true);
    plan.put("payloadBuildExecuted", ready);
    plan.put("payloadPreview", ready ? payloadPreview(sourceResult, decisionDryRunPlan) : Map.of());
    plan.put("payloadWritten", false);
    plan.put("logExecuted", false);
    plan.put("databaseWriteExecuted", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("decisionApplied", false);
    plan.put("throwRequested", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("blockedReasons", blockedReasons(sourceResult, loggingAllowed, observationPlanAvailable));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_listener_observation_payload_logging_batch"
            : "keep_observation_log_payload_construction_blocked_until_gate_ready");
    return plan;
  }

  private Map<String, Object> payloadPreview(
      OrganizationProvisioningCompletedNotificationConsumeResult sourceResult,
      Map<String, Object> decisionDryRunPlan) {
    Map<String, Object> plan = mapValue(decisionDryRunPlan);
    Map<String, Object> bridgeResult = mapValue(plan.get("bridgeResult"));
    Map<String, Object> policyDecisionPlan = mapValue(plan.get("policyDecisionPlan"));
    Map<String, Object> observationPlan = mapValue(plan.get("decisionOutputObservationPlan"));

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("eventId", sourceResult.eventId());
    payload.put("idempotencyKey", sourceResult.idempotencyKey());
    payload.put("bridgeResult", bridgePayload(bridgeResult));
    payload.put("policyDecisionPlan", policyPayload(policyDecisionPlan));
    payload.put("blockedReasons", stringList(plan.get("blockedReasons")));
    payload.put("logMessageKey", observationPlan.get("logMessageKey"));
    return payload;
  }

  private Map<String, Object> bridgePayload(Map<String, Object> bridgeResult) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("classificationStatus", bridgeResult.get("classificationStatus"));
    payload.put("futureReturnThrowDecision", bridgeResult.get("futureReturnThrowDecision"));
    return payload;
  }

  private Map<String, Object> policyPayload(Map<String, Object> policyDecisionPlan) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("planStatus", policyDecisionPlan.get("planStatus"));
    payload.put("futureListenerDecision", policyDecisionPlan.get("futureListenerDecision"));
    payload.put("decisionApplied", policyDecisionPlan.get("decisionApplied"));
    return payload;
  }

  private List<String> blockedReasons(
      OrganizationProvisioningCompletedNotificationConsumeResult sourceResult,
      boolean loggingAllowed,
      boolean observationPlanAvailable) {
    List<String> reasons = new java.util.ArrayList<>();
    if (sourceResult == null) {
      reasons.add("source result 缺失，不能构造 observation log payload");
    }
    if (!loggingAllowed) {
      reasons.add("decision output observation logging gate 尚未 ready");
    }
    if (!observationPlanAvailable) {
      reasons.add("decisionOutputObservationPlan 缺失，不能构造 observation log payload");
    }
    return reasons;
  }

  private Map<String, Object> mapValue(Object value) {
    if (value instanceof Map<?, ?> map) {
      Map<String, Object> result = new LinkedHashMap<>();
      for (Map.Entry<?, ?> entry : map.entrySet()) {
        result.put(String.valueOf(entry.getKey()), entry.getValue());
      }
      return result;
    }
    return Map.of();
  }

  private List<String> stringList(Object value) {
    if (value instanceof List<?> list) {
      return list.stream().map(String::valueOf).toList();
    }
    return List.of();
  }
}

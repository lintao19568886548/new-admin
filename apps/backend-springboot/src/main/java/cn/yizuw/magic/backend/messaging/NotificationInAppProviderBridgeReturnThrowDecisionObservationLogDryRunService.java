package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** observation log 记录动作的 dry-run 预案；不调用 Logger，不写数据库。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService {

  public Map<String, Object> buildDryRun(
      Map<String, Object> payloadDryRunPlan, Map<String, Object> loggingGatePlan) {
    Map<String, Object> payloadPlan = mapValue(payloadDryRunPlan);
    Map<String, Object> payloadPreview = mapValue(payloadPlan.get("payloadPreview"));
    boolean loggingAllowed =
        Boolean.TRUE.equals(mapValue(loggingGatePlan).get("observationLoggingAllowed"));
    boolean payloadBuildExecuted =
        Boolean.TRUE.equals(payloadPlan.get("payloadBuildExecuted"));
    boolean payloadPreviewAvailable = !payloadPreview.isEmpty();
    boolean ready = loggingAllowed && payloadBuildExecuted && payloadPreviewAvailable;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_log_execution");
    plan.put(
        "planStatus",
        ready ? "ready_for_bridge_return_throw_decision_observation_log_dry_run" : "blocked");
    plan.put("payloadDryRunPlanProvided", !payloadPlan.isEmpty());
    plan.put("payloadBuildExecuted", payloadBuildExecuted);
    plan.put("payloadPreviewAvailable", payloadPreviewAvailable);
    plan.put("observationLoggingAllowed", loggingAllowed);
    plan.put("logMessageKey", ready ? payloadPreview.get("logMessageKey") : null);
    plan.put("logPayloadPreview", ready ? payloadPreview : Map.of());
    plan.put("observationLoggingRequested", true);
    plan.put("observationLoggingExecuted", false);
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
        "blockedReasons",
        blockedReasons(payloadPlan, payloadBuildExecuted, payloadPreviewAvailable, loggingAllowed));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_listener_observation_logging_integration_batch"
            : "keep_observation_logging_blocked_until_payload_and_gate_ready");
    return plan;
  }

  private List<String> blockedReasons(
      Map<String, Object> payloadPlan,
      boolean payloadBuildExecuted,
      boolean payloadPreviewAvailable,
      boolean loggingAllowed) {
    List<String> reasons = new ArrayList<>();
    if (payloadPlan.isEmpty()) {
      reasons.add("payload dry-run plan 缺失，不能规划 observation logging");
    }
    if (!payloadBuildExecuted) {
      reasons.add("payloadBuildExecuted=false，不能规划 observation logging");
    }
    if (!payloadPreviewAvailable) {
      reasons.add("payloadPreview 缺失，不能规划 observation logging");
    }
    if (!loggingAllowed) {
      reasons.add("decision output observation logging gate 尚未 ready");
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
}

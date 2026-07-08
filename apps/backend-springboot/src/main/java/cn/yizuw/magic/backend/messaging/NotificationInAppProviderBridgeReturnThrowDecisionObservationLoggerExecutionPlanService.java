package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** observation logger execution plan；只定义灰度执行合同，不持有 Logger、不写日志。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService {

  public Map<String, Object> buildPlan(
      Map<String, Object> loggerInvocationDryRunPlan, Map<String, Object> loggerExecutionGatePlan) {
    Map<String, Object> invocationPlan = mapValue(loggerInvocationDryRunPlan);
    String formattedMessagePreview = stringValue(invocationPlan.get("formattedMessagePreview"));
    boolean loggerInvocationPlanned =
        Boolean.TRUE.equals(invocationPlan.get("loggerInvocationPlanned"));
    boolean formattedMessagePreviewAvailable = !formattedMessagePreview.isBlank();
    boolean loggerExecutionAllowed =
        Boolean.TRUE.equals(mapValue(loggerExecutionGatePlan).get("loggerExecutionAllowed"));
    boolean ready =
        loggerInvocationPlanned && formattedMessagePreviewAvailable && loggerExecutionAllowed;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_logger_execution");
    plan.put(
        "planStatus",
        ready ? "ready_for_guarded_observation_logger_execution" : "blocked");
    plan.put("loggerInvocationDryRunPlanProvided", !invocationPlan.isEmpty());
    plan.put("loggerInvocationPlanned", loggerInvocationPlanned);
    plan.put("formattedMessagePreviewAvailable", formattedMessagePreviewAvailable);
    plan.put("loggerExecutionAllowed", loggerExecutionAllowed);
    plan.put("loggerExecutionRequiresExplicitGate", true);
    plan.put("allowedLoggerName", ready ? "NotificationRoutingRabbitListener" : null);
    plan.put("allowedLogLevel", ready ? "INFO" : null);
    plan.put("allowedMessageSource", "formattedMessagePreview");
    plan.put("formattedMessagePreview", ready ? formattedMessagePreview : "");
    plan.put("loggerExecutionRequested", true);
    plan.put("loggerExecutionPlanned", ready);
    plan.put("loggerInvocationExecuted", false);
    plan.put("logExecuted", false);
    plan.put("databaseWriteExecuted", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("decisionApplied", false);
    plan.put("throwRequested", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("rabbitRejectExecuted", false);
    plan.put(
        "blockedReasons",
        blockedReasons(
            invocationPlan,
            loggerInvocationPlanned,
            formattedMessagePreviewAvailable,
            loggerExecutionAllowed));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_guarded_logger_invocation_source_integration_batch"
            : "keep_logger_execution_blocked_until_invocation_plan_and_gate_ready");
    return plan;
  }

  private List<String> blockedReasons(
      Map<String, Object> invocationPlan,
      boolean loggerInvocationPlanned,
      boolean formattedMessagePreviewAvailable,
      boolean loggerExecutionAllowed) {
    List<String> reasons = new ArrayList<>();
    if (invocationPlan.isEmpty()) {
      reasons.add("logger invocation dry-run plan 缺失，不能规划真实 Logger 灰度执行");
    }
    if (!loggerInvocationPlanned) {
      reasons.add("loggerInvocationPlanned=false，不能规划真实 Logger 灰度执行");
    }
    if (!formattedMessagePreviewAvailable) {
      reasons.add("formattedMessagePreview 缺失，不能规划真实 Logger 灰度执行");
    }
    if (!loggerExecutionAllowed) {
      reasons.add("logger execution gate 尚未 ready");
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

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** observation logger invocation dry-run；只规划 Logger 调用，不执行日志写入。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService {

  public Map<String, Object> buildDryRun(
      Map<String, Object> messageDryRunPlan, Map<String, Object> loggerInvocationGatePlan) {
    Map<String, Object> messagePlan = mapValue(messageDryRunPlan);
    String formattedMessagePreview = stringValue(messagePlan.get("formattedMessagePreview"));
    boolean messageFormattingPreviewGenerated =
        Boolean.TRUE.equals(messagePlan.get("messageFormattingPreviewGenerated"));
    boolean formattedMessagePreviewAvailable = !formattedMessagePreview.isBlank();
    boolean loggerInvocationAllowed =
        Boolean.TRUE.equals(mapValue(loggerInvocationGatePlan).get("loggerInvocationAllowed"));
    boolean ready =
        loggerInvocationAllowed
            && messageFormattingPreviewGenerated
            && formattedMessagePreviewAvailable;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_logger_invocation");
    plan.put(
        "planStatus",
        ready
            ? "ready_for_bridge_return_throw_decision_observation_logger_invocation_dry_run"
            : "blocked");
    plan.put("messageDryRunPlanProvided", !messagePlan.isEmpty());
    plan.put("messageFormattingPreviewGenerated", messageFormattingPreviewGenerated);
    plan.put("formattedMessagePreviewAvailable", formattedMessagePreviewAvailable);
    plan.put("loggerInvocationAllowed", loggerInvocationAllowed);
    plan.put("loggerNamePreview", ready ? "NotificationRoutingRabbitListener" : null);
    plan.put("logLevelPreview", ready ? "INFO" : null);
    plan.put("formattedMessagePreview", ready ? formattedMessagePreview : "");
    plan.put("loggerInvocationRequested", true);
    plan.put("loggerInvocationPlanned", ready);
    plan.put("loggerInvocationExecuted", false);
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
        blockedReasons(
            messagePlan,
            messageFormattingPreviewGenerated,
            formattedMessagePreviewAvailable,
            loggerInvocationAllowed));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_listener_logger_invocation_integration_batch"
            : "keep_logger_invocation_blocked_until_message_and_gate_ready");
    return plan;
  }

  private List<String> blockedReasons(
      Map<String, Object> messagePlan,
      boolean messageFormattingPreviewGenerated,
      boolean formattedMessagePreviewAvailable,
      boolean loggerInvocationAllowed) {
    List<String> reasons = new ArrayList<>();
    if (messagePlan.isEmpty()) {
      reasons.add("message dry-run plan 缺失，不能规划 Logger 调用");
    }
    if (!messageFormattingPreviewGenerated) {
      reasons.add("messageFormattingPreviewGenerated=false，不能规划 Logger 调用");
    }
    if (!formattedMessagePreviewAvailable) {
      reasons.add("formattedMessagePreview 缺失，不能规划 Logger 调用");
    }
    if (!loggerInvocationAllowed) {
      reasons.add("logger invocation gate 尚未 ready");
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

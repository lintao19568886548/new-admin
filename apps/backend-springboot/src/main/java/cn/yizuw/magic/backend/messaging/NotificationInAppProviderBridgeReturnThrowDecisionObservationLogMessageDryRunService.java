package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** observation log message formatting dry-run；不调用 Logger，不写数据库。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService {

  public Map<String, Object> buildDryRun(Map<String, Object> observationLogDryRunPlan) {
    Map<String, Object> logPlan = mapValue(observationLogDryRunPlan);
    Map<String, Object> payloadPreview = mapValue(logPlan.get("logPayloadPreview"));
    String logMessageKey = stringValue(logPlan.get("logMessageKey"));
    boolean logPlanned = Boolean.TRUE.equals(logPlan.get("logPlanned"));
    boolean payloadAvailable = !payloadPreview.isEmpty();
    boolean messageKeyAvailable = !logMessageKey.isBlank();
    boolean ready = logPlanned && payloadAvailable && messageKeyAvailable;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_log_message_format");
    plan.put(
        "planStatus",
        ready
            ? "ready_for_bridge_return_throw_decision_observation_log_message_dry_run"
            : "blocked");
    plan.put("observationLogDryRunPlanProvided", !logPlan.isEmpty());
    plan.put("logPlanned", logPlanned);
    plan.put("logPayloadPreviewAvailable", payloadAvailable);
    plan.put("logMessageKeyAvailable", messageKeyAvailable);
    plan.put("logMessageKey", ready ? logMessageKey : null);
    plan.put("formattedMessagePreview", ready ? formattedMessage(logMessageKey, payloadPreview) : "");
    plan.put("messageFormattingRequested", true);
    plan.put("messageFormattingPreviewGenerated", ready);
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
        blockedReasons(logPlan, logPlanned, payloadAvailable, messageKeyAvailable));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_logger_invocation_integration_batch"
            : "keep_observation_log_message_formatting_blocked_until_log_plan_ready");
    return plan;
  }

  private String formattedMessage(String logMessageKey, Map<String, Object> payloadPreview) {
    Map<String, Object> bridgeResult = mapValue(payloadPreview.get("bridgeResult"));
    Map<String, Object> policyDecisionPlan = mapValue(payloadPreview.get("policyDecisionPlan"));
    return logMessageKey
        + " eventId="
        + stringValue(payloadPreview.get("eventId"))
        + " idempotencyKey="
        + stringValue(payloadPreview.get("idempotencyKey"))
        + " classificationStatus="
        + stringValue(bridgeResult.get("classificationStatus"))
        + " futureListenerDecision="
        + stringValue(policyDecisionPlan.get("futureListenerDecision"));
  }

  private List<String> blockedReasons(
      Map<String, Object> logPlan,
      boolean logPlanned,
      boolean payloadAvailable,
      boolean messageKeyAvailable) {
    List<String> reasons = new ArrayList<>();
    if (logPlan.isEmpty()) {
      reasons.add("observation log dry-run plan 缺失，不能格式化日志消息");
    }
    if (!logPlanned) {
      reasons.add("logPlanned=false，不能格式化日志消息");
    }
    if (!payloadAvailable) {
      reasons.add("logPayloadPreview 缺失，不能格式化日志消息");
    }
    if (!messageKeyAvailable) {
      reasons.add("logMessageKey 缺失，不能格式化日志消息");
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

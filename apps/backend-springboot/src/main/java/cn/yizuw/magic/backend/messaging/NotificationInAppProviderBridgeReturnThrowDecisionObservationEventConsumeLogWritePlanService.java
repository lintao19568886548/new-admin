package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** observation event_consume_log write plan；只描述未来写库合同，不执行 SQL。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService {

  public Map<String, Object> buildPlan(
      Map<String, Object> loggerExecutionPlan, Map<String, Object> eventConsumeLogWriteGatePlan) {
    Map<String, Object> loggerPlan = mapValue(loggerExecutionPlan);
    String formattedMessagePreview = stringValue(loggerPlan.get("formattedMessagePreview"));
    boolean loggerExecutionPlanned = Boolean.TRUE.equals(loggerPlan.get("loggerExecutionPlanned"));
    boolean formattedMessagePreviewAvailable = !formattedMessagePreview.isBlank();
    boolean eventConsumeLogWriteAllowed =
        Boolean.TRUE.equals(
            mapValue(eventConsumeLogWriteGatePlan).get("eventConsumeLogWriteAllowed"));
    boolean ready =
        loggerExecutionPlanned && formattedMessagePreviewAvailable && eventConsumeLogWriteAllowed;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_event_consume_log_write");
    plan.put(
        "planStatus",
        ready ? "ready_for_observation_event_consume_log_write_dry_run" : "blocked");
    plan.put("loggerExecutionPlanProvided", !loggerPlan.isEmpty());
    plan.put("loggerExecutionPlanned", loggerExecutionPlanned);
    plan.put("formattedMessagePreviewAvailable", formattedMessagePreviewAvailable);
    plan.put("eventConsumeLogWriteAllowed", eventConsumeLogWriteAllowed);
    plan.put("targetTable", ready ? "event_consume_log" : null);
    plan.put("writeMode", ready ? "future_observation_log_insert_or_update" : null);
    plan.put("messageSource", ready ? "formattedMessagePreview" : null);
    plan.put("formattedMessagePreview", ready ? formattedMessagePreview : "");
    plan.put("databaseWriteRequested", true);
    plan.put("databaseWritePlanned", ready);
    plan.put("databaseWriteExecuted", false);
    plan.put("sqlExecuted", false);
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
            loggerPlan,
            loggerExecutionPlanned,
            formattedMessagePreviewAvailable,
            eventConsumeLogWriteAllowed));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_event_consume_log_repository_integration_batch"
            : "keep_event_consume_log_write_blocked_until_logger_plan_and_gate_ready");
    return plan;
  }

  private List<String> blockedReasons(
      Map<String, Object> loggerPlan,
      boolean loggerExecutionPlanned,
      boolean formattedMessagePreviewAvailable,
      boolean eventConsumeLogWriteAllowed) {
    List<String> reasons = new ArrayList<>();
    if (loggerPlan.isEmpty()) {
      reasons.add("logger execution plan 缺失，不能规划 event_consume_log 写入");
    }
    if (!loggerExecutionPlanned) {
      reasons.add("loggerExecutionPlanned=false，不能规划 event_consume_log 写入");
    }
    if (!formattedMessagePreviewAvailable) {
      reasons.add("formattedMessagePreview 缺失，不能规划 event_consume_log 写入");
    }
    if (!eventConsumeLogWriteAllowed) {
      reasons.add("event_consume_log write gate 尚未 ready");
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

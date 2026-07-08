package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** recordSuccess 执行门控预案；只描述未来显式开关，不调用仓储。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService {

  public Map<String, Object> buildPlan(
      Map<String, Object> repositoryCallPlan, Map<String, Object> executionGatePlan) {
    Map<String, Object> callPlan = mapValue(repositoryCallPlan);
    Map<String, Object> gatePlan = mapValue(executionGatePlan);
    boolean repositoryCallPlanned = Boolean.TRUE.equals(callPlan.get("repositoryCallPlanned"));
    boolean repositoryBeanReady =
        "EventConsumeLogRepository".equals(stringValue(callPlan.get("repositoryBeanPreview")));
    boolean repositoryMethodReady =
        "recordSuccess".equals(stringValue(callPlan.get("repositoryMethodPreview")));
    Map<String, Object> argumentPreview = mapValue(callPlan.get("repositoryArgumentPreview"));
    boolean argumentReady =
        "EventConsumeLogEntry".equals(stringValue(argumentPreview.get("type")))
            && !stringValue(argumentPreview.get("consumerGroup")).isBlank()
            && !stringValue(argumentPreview.get("eventId")).isBlank()
            && !stringValue(argumentPreview.get("eventType")).isBlank()
            && !stringValue(argumentPreview.get("idempotencyKey")).isBlank()
            && !stringValue(argumentPreview.get("topic")).isBlank();
    boolean explicitGateAllowed =
        Boolean.TRUE.equals(gatePlan.get("recordSuccessExecutionAllowed"));
    boolean ready =
        repositoryCallPlanned
            && repositoryBeanReady
            && repositoryMethodReady
            && argumentReady
            && explicitGateAllowed;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_event_consume_log_record_success_execution_gate");
    plan.put("planStatus", ready ? "ready_for_record_success_execution_dry_run" : "blocked");
    plan.put("repositoryCallPlanProvided", !callPlan.isEmpty());
    plan.put("repositoryCallReady", repositoryCallPlanned);
    plan.put("repositoryBeanReady", repositoryBeanReady);
    plan.put("repositoryMethodReady", repositoryMethodReady);
    plan.put("repositoryArgumentReady", argumentReady);
    plan.put("executionGateProvided", !gatePlan.isEmpty());
    plan.put("recordSuccessExecutionAllowed", explicitGateAllowed);
    plan.put("recordSuccessExecutionPlanned", ready);
    plan.put("repositoryBeanPreview", ready ? "EventConsumeLogRepository" : "");
    plan.put("repositoryMethodPreview", ready ? "recordSuccess" : "");
    plan.put("repositoryArgumentPreview", ready ? argumentPreview : Map.of());
    plan.put("repositoryInvoked", false);
    plan.put("insertedResultObserved", false);
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
            callPlan,
            repositoryCallPlanned,
            repositoryBeanReady,
            repositoryMethodReady,
            argumentReady,
            explicitGateAllowed));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_event_consume_log_record_success_listener_integration_batch"
            : "keep_record_success_execution_blocked_until_call_plan_and_gate_ready");
    return plan;
  }

  private List<String> blockedReasons(
      Map<String, Object> callPlan,
      boolean repositoryCallPlanned,
      boolean repositoryBeanReady,
      boolean repositoryMethodReady,
      boolean argumentReady,
      boolean explicitGateAllowed) {
    List<String> reasons = new ArrayList<>();
    if (callPlan.isEmpty()) {
      reasons.add("repository call plan 缺失，不能规划 recordSuccess 执行");
    }
    if (!repositoryCallPlanned) {
      reasons.add("repositoryCallPlanned=false，不能规划 recordSuccess 执行");
    }
    if (!repositoryBeanReady) {
      reasons.add("repositoryBeanPreview 不是 EventConsumeLogRepository");
    }
    if (!repositoryMethodReady) {
      reasons.add("repositoryMethodPreview 不是 recordSuccess");
    }
    if (!argumentReady) {
      reasons.add("repositoryArgumentPreview 缺失，不能构造 recordSuccess 参数");
    }
    if (!explicitGateAllowed) {
      reasons.add("recordSuccess execution gate 尚未开启");
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

package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** recordSuccess 真实执行前的 adapter 干跑预案；只描述未来执行动作，不执行数据库写。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService {
  private static final String EXPECTED_ADAPTER_PROPERTY =
      "RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ADAPTER_ENABLED";

  public Map<String, Object> buildPlan(
      Map<String, Object> executionSwitchPlan, Map<String, Object> executionAdapterPlan) {
    Map<String, Object> switchPlan = mapValue(executionSwitchPlan);
    Map<String, Object> adapterPlan = mapValue(executionAdapterPlan);
    boolean executionSwitchReady =
        "ready_for_record_success_execution_adapter_dry_run"
            .equals(stringValue(switchPlan.get("planStatus")));
    boolean executionSwitchProvided = !switchPlan.isEmpty();
    boolean executionAdapterProvided = !adapterPlan.isEmpty();
    boolean executionAdapterPropertyReady =
        EXPECTED_ADAPTER_PROPERTY.equals(
            stringValue(adapterPlan.get("recordSuccessExecutionAdapterProperty")));
    boolean recordSuccessExecutionPlanned =
        Boolean.TRUE.equals(switchPlan.get("recordSuccessExecutionPlanned"));
    boolean recordSuccessExecutionAdapterPlanned =
        Boolean.TRUE.equals(switchPlan.get("recordSuccessExecutionAdapterPlanned"));
    boolean executionAdapterAllowed =
        Boolean.TRUE.equals(adapterPlan.get("recordSuccessExecutionAdapterAllowed"));
    Map<String, Object> argumentPreview = mapValue(switchPlan.get("repositoryArgumentPreview"));
    boolean argumentReady =
        "EventConsumeLogEntry".equals(stringValue(argumentPreview.get("type")))
            && !stringValue(argumentPreview.get("consumerGroup")).isBlank()
            && !stringValue(argumentPreview.get("eventId")).isBlank()
            && !stringValue(argumentPreview.get("eventType")).isBlank()
            && !stringValue(argumentPreview.get("idempotencyKey")).isBlank()
            && !stringValue(argumentPreview.get("topic")).isBlank();
    boolean repositoryBeanReady = "EventConsumeLogRepository".equals(stringValue(switchPlan.get("repositoryBeanPreview")));
    boolean repositoryMethodReady = "recordSuccess".equals(stringValue(switchPlan.get("repositoryMethodPreview")));
    boolean ready =
        executionSwitchReady
        && executionSwitchProvided
        && recordSuccessExecutionPlanned
        && recordSuccessExecutionAdapterPlanned
        && executionAdapterProvided
        && executionAdapterPropertyReady
        && executionAdapterAllowed
        && repositoryBeanReady
        && repositoryMethodReady
        && argumentReady;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_event_consume_log_record_success_execution_adapter");
    plan.put(
        "planStatus",
        ready ? "ready_for_record_success_execution_adapter_listener_dry_run" : "blocked");
    plan.put("executionSwitchPlanProvided", !switchPlan.isEmpty());
    plan.put("recordSuccessExecutionSwitchReady", executionSwitchReady);
    plan.put("recordSuccessExecutionPlanned", recordSuccessExecutionPlanned);
    plan.put("recordSuccessExecutionAdapterPlanned", recordSuccessExecutionAdapterPlanned);
    plan.put("executionAdapterPlanProvided", !adapterPlan.isEmpty());
    plan.put("recordSuccessExecutionAdapterAllowed", executionAdapterAllowed);
    plan.put("executionAdapterPlanned", ready);
    plan.put("repositoryBeanPreview", ready ? "EventConsumeLogRepository" : "");
    plan.put("repositoryMethodPreview", ready ? "recordSuccess" : "");
    plan.put("repositoryArgumentPreview", ready ? argumentPreview : Map.of());
    plan.put("recordSuccessExecutionListenerPlanned", ready);
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
            switchPlan,
            executionSwitchReady,
            recordSuccessExecutionPlanned,
            recordSuccessExecutionAdapterPlanned,
            executionAdapterProvided,
            executionAdapterAllowed,
            repositoryBeanReady,
            repositoryMethodReady,
            argumentReady,
            executionAdapterPlan));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_record_success_execution_listener_batch"
            : "keep_record_success_execution_adapter_blocked_until_execution_switch_and_adapter_ready");
    return plan;
  }

  private List<String> blockedReasons(
      Map<String, Object> switchPlan,
      boolean executionSwitchReady,
      boolean recordSuccessExecutionPlanned,
      boolean recordSuccessExecutionAdapterPlanned,
      boolean executionAdapterProvided,
      boolean executionAdapterAllowed,
      boolean repositoryBeanReady,
      boolean repositoryMethodReady,
      boolean argumentReady,
      Map<String, Object> executionAdapterPlan) {
    List<String> reasons = new ArrayList<>();
    if (switchPlan.isEmpty()) {
      reasons.add("recordSuccess execution switch plan 缺失，不能规划 execution adapter");
    }
    if (!executionSwitchReady) {
      reasons.add("execution switch plan 尚未 ready");
    }
    if (!recordSuccessExecutionPlanned) {
      reasons.add("recordSuccessExecutionPlanned=false，不能进入 execution adapter");
    }
    if (!recordSuccessExecutionAdapterPlanned) {
      reasons.add("recordSuccessExecutionAdapterPlanned=false，不能进入 execution adapter");
    }
    if (!executionAdapterAllowed) {
      reasons.add("recordSuccess execution adapter 尚未开启");
    }
    if (!executionAdapterProvided) {
      reasons.add("recordSuccess execution adapter plan 缺失");
    }
    if (!executionAdapterPlan.isEmpty()
        && !EXPECTED_ADAPTER_PROPERTY.equals(
            stringValue(executionAdapterPlan.get("recordSuccessExecutionAdapterProperty")))) {
      reasons.add("recordSuccess execution adapter property 与预期不匹配");
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

package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** recordSuccess 真实执行前的显式开关预案；只描述开关状态，不调用仓储。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService {

  private static final String EXPECTED_SWITCH_PROPERTY =
      "RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED";

  public Map<String, Object> buildPlan(
      Map<String, Object> executionGatePlan, Map<String, Object> executionSwitchPlan) {
    Map<String, Object> gatePlan = mapValue(executionGatePlan);
    Map<String, Object> switchPlan = mapValue(executionSwitchPlan);
    boolean gateReady =
        "ready_for_record_success_execution_dry_run"
            .equals(stringValue(gatePlan.get("planStatus")));
    boolean recordSuccessExecutionPlanned =
        Boolean.TRUE.equals(gatePlan.get("recordSuccessExecutionPlanned"));
    boolean switchProvided = !switchPlan.isEmpty();
    String switchProperty = stringValue(switchPlan.get("recordSuccessExecutionSwitchProperty"));
    boolean switchPropertyReady = EXPECTED_SWITCH_PROPERTY.equals(switchProperty);
    boolean switchAllowed =
        Boolean.TRUE.equals(switchPlan.get("recordSuccessExecutionSwitchAllowed"));
    boolean ready =
        gateReady && recordSuccessExecutionPlanned && switchProvided && switchPropertyReady && switchAllowed;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_event_consume_log_record_success_execution_switch");
    plan.put(
        "planStatus",
        ready ? "ready_for_record_success_execution_adapter_dry_run" : "blocked");
    plan.put("recordSuccessExecutionGatePlanProvided", !gatePlan.isEmpty());
    plan.put("recordSuccessExecutionGateReady", gateReady);
    plan.put("recordSuccessExecutionPlanned", recordSuccessExecutionPlanned);
    plan.put("recordSuccessExecutionSwitchProvided", switchProvided);
    plan.put("recordSuccessExecutionSwitchPropertyExpected", EXPECTED_SWITCH_PROPERTY);
    plan.put("recordSuccessExecutionSwitchPropertyPreview", switchProperty);
    plan.put("recordSuccessExecutionSwitchPropertyReady", switchPropertyReady);
    plan.put("recordSuccessExecutionSwitchAllowed", switchAllowed);
    plan.put("recordSuccessExecutionAdapterPlanned", ready);
    plan.put("repositoryBeanPreview", ready ? "EventConsumeLogRepository" : "");
    plan.put("repositoryMethodPreview", ready ? "recordSuccess" : "");
    plan.put("repositoryArgumentPreview", ready ? mapValue(gatePlan.get("repositoryArgumentPreview")) : Map.of());
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
            gatePlan,
            gateReady,
            recordSuccessExecutionPlanned,
            switchProvided,
            switchPropertyReady,
            switchAllowed));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_event_consume_log_record_success_execution_adapter_batch"
            : "keep_record_success_execution_blocked_until_explicit_switch_ready");
    return plan;
  }

  private List<String> blockedReasons(
      Map<String, Object> gatePlan,
      boolean gateReady,
      boolean recordSuccessExecutionPlanned,
      boolean switchProvided,
      boolean switchPropertyReady,
      boolean switchAllowed) {
    List<String> reasons = new ArrayList<>();
    if (gatePlan.isEmpty()) {
      reasons.add("recordSuccess execution gate plan 缺失");
    }
    if (!gateReady) {
      reasons.add("recordSuccess execution gate 尚未 ready");
    }
    if (!recordSuccessExecutionPlanned) {
      reasons.add("recordSuccessExecutionPlanned=false，不能进入执行适配预案");
    }
    if (!switchProvided) {
      reasons.add("recordSuccess execution switch plan 缺失");
    }
    if (!switchPropertyReady) {
      reasons.add("recordSuccess execution switch property 未匹配预期显式开关");
    }
    if (!switchAllowed) {
      reasons.add("recordSuccess execution switch 尚未开启");
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

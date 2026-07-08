package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** listener 自动执行手动 provider 前的调用预案；只生成 dry-run，不执行调用。 */
@Service
public class OrganizationProvisioningCompletedInAppListenerAutoExecutionInvocationPlanService {

  /**
   * 生成未来 listener 调用手动执行 service 的 dry-run 计划。
   *
   * <p>本方法不注入或调用 `OrganizationProvisioningCompletedInAppProviderManualExecutionService`，
   * 不确认 RabbitMQ 消息，也不执行 websocket/push。
   */
  public Map<String, Object> buildPlan(
      Map<String, Object> inAppExecutionPlan,
      List<String> gateFailedChecks,
      boolean listenerAutoExecutionAllowed) {
    List<Map<String, Object>> invocationArguments = invocationArguments(inAppExecutionPlan);
    List<String> blockedReasons =
        blockedReasons(inAppExecutionPlan, gateFailedChecks, invocationArguments);
    boolean ready = listenerAutoExecutionAllowed && blockedReasons.isEmpty();

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "organization.provisioning.completed.notification.in_app.listener_auto_execution_invocation");
    plan.put("planStatus", ready ? "ready_for_invocation_dry_run" : "blocked");
    plan.put("listenerAutoExecutionAllowed", listenerAutoExecutionAllowed);
    plan.put("manualExecutionBean", inAppExecutionPlan.get("manualExecutionBean"));
    plan.put("manualExecutionMethod", "execute");
    plan.put("manualExecutionArgumentSource", "inAppExecutionPlan");
    plan.put(
        "invocationOrder",
        List.of(
            "validate_gate",
            "call_manual_execution_service",
            "ack_if_success_or_duplicate"));
    plan.put("ackStrategy", "ack_only_after_manual_execution_success_or_duplicate");
    plan.put("nackStrategy", "throw_to_rabbitmq_retry_or_dlq_on_blocked_or_failed");
    plan.put("manualExecutionRequested", false);
    plan.put("manualExecutionExecuted", false);
    plan.put("listenerInvocationExecuted", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("websocketExecuted", false);
    plan.put("pushExecuted", false);
    plan.put("executionBoundary", "第 176 批只生成 listener 调用手动执行 service 的 dry-run 预案，不执行调用");
    plan.put("invocationArguments", invocationArguments);
    plan.put("expectedResultFields", expectedResultFields());
    plan.put("blockedReasons", blockedReasons);
    plan.put("nextAction", nextAction(ready));
    return plan;
  }

  private List<Map<String, Object>> invocationArguments(Map<String, Object> inAppExecutionPlan) {
    Map<String, Object> argument = new LinkedHashMap<>();
    argument.put("argumentName", "inAppExecutionPlan");
    argument.put("argumentType", "Map<String,Object>");
    argument.put("planType", inAppExecutionPlan.get("planType"));
    argument.put("planStatus", inAppExecutionPlan.get("planStatus"));
    argument.put("channel", inAppExecutionPlan.get("channel"));
    argument.put("eventId", inAppExecutionPlan.get("eventId"));
    argument.put("idempotencyKey", inAppExecutionPlan.get("idempotencyKey"));
    argument.put("recipientCount", inAppExecutionPlan.get("recipientCount"));
    argument.put(
        "containsExecutorPreflightPlan", inAppExecutionPlan.containsKey("executorPreflightPlan"));
    argument.put("containsWritePreview", inAppExecutionPlan.containsKey("writePreview"));
    argument.put(
        "containsNotificationInsertPlan",
        containsNestedPlan(inAppExecutionPlan, "notificationInsertPlan"));
    argument.put(
        "containsWebsocketPushDeliveryPlan",
        containsNestedPlan(inAppExecutionPlan, "websocketPushDeliveryPlan"));
    return List.of(argument);
  }

  private List<String> blockedReasons(
      Map<String, Object> inAppExecutionPlan,
      List<String> gateFailedChecks,
      List<Map<String, Object>> invocationArguments) {
    List<String> reasons = new ArrayList<>();
    if (gateFailedChecks != null && !gateFailedChecks.isEmpty()) {
      reasons.add("listener 自动执行综合安全门仍有失败项: " + gateFailedChecks);
    }
    if (!"ready_for_write_plan".equals(stringValue(inAppExecutionPlan.get("planStatus")))) {
      reasons.add("inAppExecutionPlan 尚未 ready_for_write_plan，不能构造 listener 调用参数");
    }
    for (Map<String, Object> argument : invocationArguments) {
      if (!Boolean.TRUE.equals(argument.get("containsExecutorPreflightPlan"))) {
        reasons.add("listener 调用参数缺少 executorPreflightPlan");
      }
      if (!Boolean.TRUE.equals(argument.get("containsWritePreview"))) {
        reasons.add("listener 调用参数缺少 writePreview");
      }
      if (!Boolean.TRUE.equals(argument.get("containsNotificationInsertPlan"))) {
        reasons.add("listener 调用参数缺少 notificationInsertPlan");
      }
      if (!Boolean.TRUE.equals(argument.get("containsWebsocketPushDeliveryPlan"))) {
        reasons.add("listener 调用参数缺少 websocketPushDeliveryPlan");
      }
    }
    return reasons.stream().filter(StringUtils::hasText).distinct().toList();
  }

  private List<String> expectedResultFields() {
    return List.of(
        "manualExecutionRequested",
        "manualExecutionExecuted",
        "manualExecutionCompleted",
        "claimResult",
        "insertResult",
        "markSuccessResult",
        "markFailureResult",
        "listenerAutoExecution",
        "websocketExecuted",
        "pushExecuted",
        "reason",
        "status");
  }

  private String nextAction(boolean ready) {
    if (ready) {
      return "ready_for_future_listener_invocation_batch_but_current_plan_does_not_call_manual_service";
    }
    return "fix_invocation_plan_blockers_before_listener_invokes_manual_service";
  }

  private boolean containsNestedPlan(Map<String, Object> plan, String nestedPlanName) {
    Object value = plan.get("writePreview");
    if (!(value instanceof Map<?, ?> map)) {
      return false;
    }
    return map.containsKey(nestedPlanName);
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

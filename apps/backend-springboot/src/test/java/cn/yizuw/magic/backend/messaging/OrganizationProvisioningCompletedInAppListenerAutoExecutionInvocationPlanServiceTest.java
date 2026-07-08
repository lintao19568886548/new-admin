package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** listener 调用手动执行 service 预案测试；第 176 批只生成 dry-run。 */
class OrganizationProvisioningCompletedInAppListenerAutoExecutionInvocationPlanServiceTest {

  private final OrganizationProvisioningCompletedInAppListenerAutoExecutionInvocationPlanService
      service =
          new OrganizationProvisioningCompletedInAppListenerAutoExecutionInvocationPlanService();

  @Test
  void buildPlanReturnsReadyDryRunWhenGateAllowedAndArgumentsAreComplete() {
    Map<String, Object> plan = service.buildPlan(inAppExecutionPlan(true), List.of(), true);

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_invocation_dry_run")
        .containsEntry("listenerAutoExecutionAllowed", true)
        .containsEntry(
            "manualExecutionBean",
            "organizationProvisioningCompletedInAppProviderManualExecutionService")
        .containsEntry("manualExecutionMethod", "execute")
        .containsEntry("manualExecutionArgumentSource", "inAppExecutionPlan")
        .containsEntry("ackStrategy", "ack_only_after_manual_execution_success_or_duplicate")
        .containsEntry("nackStrategy", "throw_to_rabbitmq_retry_or_dlq_on_blocked_or_failed")
        .containsEntry("manualExecutionRequested", false)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("listenerInvocationExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushExecuted", false)
        .containsEntry(
            "executionBoundary",
            "第 176 批只生成 listener 调用手动执行 service 的 dry-run 预案，不执行调用")
        .containsEntry(
            "nextAction",
            "ready_for_future_listener_invocation_batch_but_current_plan_does_not_call_manual_service");
    assertThat((List<Object>) plan.get("blockedReasons")).isEmpty();
    assertThat((List<Object>) plan.get("invocationOrder"))
        .containsExactly(
            "validate_gate",
            "call_manual_execution_service",
            "ack_if_success_or_duplicate");
    assertThat((List<Object>) plan.get("expectedResultFields"))
        .contains("claimResult", "insertResult", "markSuccessResult", "markFailureResult");
    assertThat((List<Object>) plan.get("invocationArguments"))
        .hasSize(1)
        .anySatisfy(
            argument ->
                assertThat((Map<String, Object>) argument)
                    .containsEntry("argumentName", "inAppExecutionPlan")
                    .containsEntry("argumentType", "Map<String,Object>")
                    .containsEntry(
                        "planType",
                        "organization.provisioning.completed.notification.in_app.execution")
                    .containsEntry("planStatus", "ready_for_write_plan")
                    .containsEntry("channel", "in_app")
                    .containsEntry("eventId", "evt_notification_31")
                    .containsEntry(
                        "idempotencyKey",
                        "organization-provisioning-completed-provider:31:in_app")
                    .containsEntry("recipientCount", 1)
                    .containsEntry("containsExecutorPreflightPlan", true)
                    .containsEntry("containsWritePreview", true)
                    .containsEntry("containsNotificationInsertPlan", true)
                    .containsEntry("containsWebsocketPushDeliveryPlan", true));
  }

  @Test
  void buildPlanBlocksWhenGateHasFailedChecks() {
    Map<String, Object> plan =
        service.buildPlan(
            inAppExecutionPlan(true),
            List.of("listener_auto_execution_gate_enabled", "claim_gate_enabled"),
            false);

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("listenerAutoExecutionAllowed", false)
        .containsEntry(
            "nextAction", "fix_invocation_plan_blockers_before_listener_invokes_manual_service");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "listener 自动执行综合安全门仍有失败项: [listener_auto_execution_gate_enabled, claim_gate_enabled]");
  }

  @Test
  void buildPlanBlocksWhenNestedArgumentsAreMissing() {
    Map<String, Object> plan = service.buildPlan(inAppExecutionPlan(false), List.of(), true);

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("listenerAutoExecutionAllowed", true);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "listener 调用参数缺少 executorPreflightPlan",
            "listener 调用参数缺少 notificationInsertPlan",
            "listener 调用参数缺少 websocketPushDeliveryPlan");
  }

  @Test
  void buildPlanBlocksWhenExecutionPlanIsNotReady() {
    Map<String, Object> executionPlan = inAppExecutionPlan(true);
    executionPlan.put("planStatus", "blocked");

    Map<String, Object> plan = service.buildPlan(executionPlan, List.of(), true);

    assertThat(plan).containsEntry("planStatus", "blocked");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains("inAppExecutionPlan 尚未 ready_for_write_plan，不能构造 listener 调用参数");
  }

  private Map<String, Object> inAppExecutionPlan(boolean completeArguments) {
    Map<String, Object> plan =
        new java.util.LinkedHashMap<>(
            Map.of(
                "planType",
                "organization.provisioning.completed.notification.in_app.execution",
                "planStatus",
                "ready_for_write_plan",
                "channel",
                "in_app",
                "eventId",
                "evt_notification_31",
                "idempotencyKey",
                "organization-provisioning-completed-provider:31:in_app",
                "recipientCount",
                1,
                "manualExecutionBean",
                "organizationProvisioningCompletedInAppProviderManualExecutionService"));
    if (completeArguments) {
      plan.put("executorPreflightPlan", Map.of("planStatus", "ready_for_claim_dry_run"));
      plan.put(
          "writePreview",
          Map.of(
              "notificationInsertPlan",
              Map.of("planStatus", "ready_for_insert_dry_run"),
              "websocketPushDeliveryPlan",
              Map.of("planStatus", "ready_for_delivery_dry_run")));
    } else {
      plan.put("writePreview", Map.of());
    }
    return plan;
  }
}

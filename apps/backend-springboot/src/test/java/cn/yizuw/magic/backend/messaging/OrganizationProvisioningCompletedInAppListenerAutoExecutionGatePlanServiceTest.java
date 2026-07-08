package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** listener 自动执行综合安全门测试；第 175 批只生成 dry-run 判定。 */
class OrganizationProvisioningCompletedInAppListenerAutoExecutionGatePlanServiceTest {

  @Test
  void buildPlanBlocksByDefaultBeforeListenerAutoExecution() {
    AppProperties appProperties = new AppProperties();
    Map<String, Object> plan = service(appProperties).buildPlan(inAppExecutionPlan(true));

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("listenerAutoExecutionAllowed", false)
        .containsEntry("listenerAutoExecutionRequested", false)
        .containsEntry("listenerAutoExecutionExecuted", false)
        .containsEntry("listenerAutoExecutionGateEnabled", false)
        .containsEntry("listenerIntegrationExecuted", false)
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushExecuted", false)
        .containsEntry(
            "executionBoundary",
            "第 175 批只生成 listener 自动执行综合安全门，不接 listener，不执行 provider")
        .containsEntry(
            "nextAction",
            "fix_listener_auto_execution_gate_blockers_before_listener_integration");
    assertThat((List<Object>) plan.get("failedChecks"))
        .contains(
            "listener_auto_execution_gate_enabled",
            "manual_ddl_applied",
            "claim_gate_enabled",
            "notification_insert_gate_enabled",
            "mark_success_gate_enabled",
            "mark_failure_gate_enabled");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains("未满足 listener 自动执行条件，本批仍只生成 dry-run 安全门");
    assertThat((Map<String, Object>) plan.get("invocationPlan"))
        .containsEntry("planStatus", "blocked")
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("listenerInvocationExecuted", false);
    assertReadinessMatrix(plan, "executor_preflight_ready", true);
    assertReadinessMatrix(plan, "notification_insert_plan_ready", true);
    assertReadinessMatrix(plan, "websocket_push_delivery_plan_ready", true);
    assertReadinessMatrix(plan, "listener_integration_side_effect_free", true);
  }

  @Test
  void buildPlanAllowsOnlyWhenEveryGateAndNestedPlanIsReady() {
    AppProperties appProperties = allGatesEnabled();

    Map<String, Object> plan = service(appProperties).buildPlan(inAppExecutionPlan(true));

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_listener_auto_execution_dry_run")
        .containsEntry("listenerAutoExecutionAllowed", true)
        .containsEntry("listenerAutoExecutionRequested", false)
        .containsEntry("listenerAutoExecutionExecuted", false)
        .containsEntry("listenerAutoExecutionGateEnabled", true)
        .containsEntry("listenerIntegrationExecuted", false)
        .containsEntry(
            "manualExecutionBean",
            "organizationProvisioningCompletedInAppProviderManualExecutionService")
        .containsEntry("executorBean", "organizationProvisioningCompletedInAppProviderExecutor")
        .containsEntry(
            "nextAction",
            "ready_for_future_listener_auto_execution_batch_but_current_plan_does_not_invoke_listener");
    assertThat((List<Object>) plan.get("failedChecks")).isEmpty();
    assertThat((List<Object>) plan.get("blockedReasons")).isEmpty();
    assertThat((Map<String, Object>) plan.get("invocationPlan"))
        .containsEntry("planStatus", "ready_for_invocation_dry_run")
        .containsEntry("listenerAutoExecutionAllowed", true)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("rabbitAckExecuted", false);
    assertReadinessMatrix(plan, "listener_auto_execution_gate_enabled", true);
    assertReadinessMatrix(plan, "provider_send_gate_enabled", true);
    assertReadinessMatrix(plan, "provider_channel_guard_in_app", true);
    assertReadinessMatrix(plan, "executor_preflight_ready", true);
    assertReadinessMatrix(plan, "notification_insert_plan_ready", true);
    assertReadinessMatrix(plan, "websocket_push_delivery_plan_ready", true);
  }

  @Test
  void buildPlanBlocksWhenProviderChannelGuardIsNotInApp() {
    AppProperties appProperties = allGatesEnabled();
    Map<String, Object> executionPlan = inAppExecutionPlan(true);
    executionPlan.put("providerChannelGuard", "sms");

    Map<String, Object> plan = service(appProperties).buildPlan(executionPlan);

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("listenerAutoExecutionAllowed", false);
    assertThat((List<Object>) plan.get("failedChecks"))
        .containsExactly("provider_channel_guard_in_app");
    assertThat((List<Object>) plan.get("blockedReasons")).contains("provider channel guard 不是 in_app");
  }

  @Test
  void buildPlanBlocksWhenNestedPlansAreNotReady() {
    AppProperties appProperties = allGatesEnabled();

    Map<String, Object> plan = service(appProperties).buildPlan(inAppExecutionPlan(false));

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("listenerAutoExecutionAllowed", false);
    assertThat((List<Object>) plan.get("failedChecks"))
        .contains(
            "executor_preflight_ready",
            "notification_insert_plan_ready",
            "websocket_push_delivery_plan_ready");
  }

  private OrganizationProvisioningCompletedInAppListenerAutoExecutionGatePlanService service(
      AppProperties appProperties) {
    return new OrganizationProvisioningCompletedInAppListenerAutoExecutionGatePlanService(
        appProperties,
        new OrganizationProvisioningCompletedInAppListenerAutoExecutionInvocationPlanService());
  }

  private AppProperties allGatesEnabled() {
    AppProperties appProperties = new AppProperties();
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderListenerAutoExecutionEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppNotificationDdlApplied(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderClaimEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppNotificationInsertEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderMarkSuccessEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderMarkFailureEnabled(true);
    return appProperties;
  }

  private Map<String, Object> inAppExecutionPlan(boolean nestedReady) {
    return new java.util.LinkedHashMap<>(
        Map.of(
            "planStatus",
            "ready_for_write_plan",
            "providerSendEnabled",
            true,
            "providerChannelGuard",
            "in_app",
            "manualExecutionBean",
            "organizationProvisioningCompletedInAppProviderManualExecutionService",
            "executorBean",
            "organizationProvisioningCompletedInAppProviderExecutor",
            "executorPreflightPlan",
            Map.of(
                "planStatus",
                nestedReady ? "ready_for_claim_dry_run" : "blocked",
                "claimReady",
                nestedReady),
            "writePreview",
            Map.of(
                "notificationInsertPlan",
                Map.of("planStatus", nestedReady ? "ready_for_insert_dry_run" : "blocked"),
                "websocketPushDeliveryPlan",
                Map.of("planStatus", nestedReady ? "ready_for_delivery_dry_run" : "blocked"))));
  }

  private void assertReadinessMatrix(
      Map<String, Object> plan, String expectedName, boolean expectedPassed) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix = (List<Map<String, Object>>) plan.get("readinessMatrix");
    assertThat(matrix)
        .anySatisfy(
            check ->
                assertThat(check)
                    .containsEntry("name", expectedName)
                    .containsEntry("passed", expectedPassed));
  }
}

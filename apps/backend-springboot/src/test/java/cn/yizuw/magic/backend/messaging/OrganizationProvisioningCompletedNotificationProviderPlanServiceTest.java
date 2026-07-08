package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 组织开通完成通知 provider 发送计划测试；确认只生成 dry-run，不触发真实发送。 */
class OrganizationProvisioningCompletedNotificationProviderPlanServiceTest {

  @Test
  void buildPlanReturnsDryRunWhenProviderSafetyGateIsDisabled() {
    Map<String, Object> plan =
        service(false)
            .buildPlan(
                31,
                "org001",
                "tenant_org001",
                "evt_notification_31",
                readyRecipientPlan(),
                List.of("in_app", "wechat_work", "sms"));

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("providerSendEnabled", false)
        .containsEntry("providerChannelGuard", "in_app")
        .containsEntry("providerReadyChannels", List.of())
        .containsEntry("providerBlockedChannels", List.of("in_app", "wechat_work", "sms"))
        .containsEntry(
            "nextAction", "fix_provider_readiness_checks_before_single_channel_execution")
        .containsEntry("providerCallRequested", false)
        .containsEntry("providerCallExecuted", false)
        .containsEntry("sendEnabled", false)
        .containsEntry("dryRun", true)
        .containsEntry("recipientCount", 1);
    assertThat((Map<String, Object>) plan.get("inAppExecutionPlan"))
        .containsEntry("planStatus", "blocked")
        .containsEntry("executionExecuted", false)
        .containsEntry("dbWriteExecuted", false);
    assertThat((List<Object>) plan.get("providerReadinessFailedChecks"))
        .containsExactly("provider_send_gate_enabled", "single_channel_guard_matched");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly(
            "RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_SEND_ENABLED 未开启",
            "provider 发送执行器尚未接入，本批只生成 dry-run 计划");
    assertChannelPlans(plan, false);
    assertReadinessMatrix(plan, "provider_execution_disabled", true);
  }

  @Test
  void buildPlanMarksOnlyGuardedChannelReadyWhenSafetyGateIsEnabled() {
    Map<String, Object> plan =
        service(true)
            .buildPlan(
                31,
                "org001",
                "tenant_org001",
                "evt_notification_31",
                readyRecipientPlan(),
                List.of("in_app", "sms"));

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_dry_run")
        .containsEntry("providerSendEnabled", true)
        .containsEntry("providerChannelGuard", "in_app")
        .containsEntry("providerReadyChannels", List.of("in_app"))
        .containsEntry("providerBlockedChannels", List.of("sms"))
        .containsEntry(
            "nextAction",
            "ready_for_single_channel_provider_execution_batch_but_current_plan_remains_dry_run")
        .containsEntry("providerCallRequested", false)
        .containsEntry("providerCallExecuted", false)
        .containsEntry("sendEnabled", false)
        .containsEntry("dryRun", true);
    assertThat((Map<String, Object>) plan.get("inAppExecutionPlan"))
        .containsEntry("planStatus", "ready_for_write_plan")
        .containsEntry("executionExecuted", false)
        .containsEntry("dbWriteExecuted", false)
        .containsEntry("smsProviderExecuted", false)
        .containsEntry("weworkProviderExecuted", false);
    assertThat((List<Object>) plan.get("providerReadinessFailedChecks")).isEmpty();
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("provider 发送执行器尚未接入，本批只生成 dry-run 计划");
    assertChannelPlans(plan, true);
    assertChannelReady(plan, "in_app", true);
    assertChannelReady(plan, "sms", false);
    assertReadinessMatrix(plan, "single_channel_guard_matched", true);
  }

  @Test
  void buildPlanBlocksWhenRecipientPlanIsNotReady() {
    Map<String, Object> plan =
        service(true)
            .buildPlan(
                31,
                "org001",
                "tenant_org001",
                "evt_notification_31",
                Map.of(
                    "recipientResolutionStatus",
                    "blocked",
                    "recipientCount",
                    0,
                    "blockedReasons",
                    List.of("组织 active 成员为空，无法生成收件人"),
                    "recipients",
                    List.of()),
                List.of("in_app"));

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("recipientResolutionStatus", "blocked")
        .containsEntry("recipientCount", 0)
        .containsEntry("providerReadyChannels", List.of())
        .containsEntry("providerBlockedChannels", List.of("in_app"))
        .containsEntry("providerCallExecuted", false)
        .containsEntry("sendEnabled", false);
    assertThat((List<Object>) plan.get("providerReadinessFailedChecks"))
        .containsExactly("recipient_plan_ready", "single_channel_guard_matched");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly(
            "收件人解析未就绪，provider 发送保持 dry-run",
            "组织 active 成员为空，无法生成收件人",
            "provider 发送执行器尚未接入，本批只生成 dry-run 计划");
    assertChannelReady(plan, "in_app", false);
  }

  @Test
  void buildPlanBlocksChannelsThatDoNotMatchGuard() {
    Map<String, Object> plan =
        service(true, "sms")
            .buildPlan(
                31,
                "org001",
                "tenant_org001",
                "evt_notification_31",
                readyRecipientPlan(),
                List.of("in_app", "sms"));

    assertThat(plan)
        .containsEntry("providerChannelGuard", "sms")
        .containsEntry("providerReadyChannels", List.of("sms"))
        .containsEntry("providerBlockedChannels", List.of("in_app"))
        .containsEntry("providerCallExecuted", false)
        .containsEntry("sendEnabled", false);
    assertChannelReady(plan, "in_app", false);
    assertChannelReady(plan, "sms", true);
  }

  @Test
  void buildPlanBlocksUnsupportedChannelEvenWhenItMatchesGuard() {
    Map<String, Object> plan =
        service(true, "email")
            .buildPlan(
                31,
                "org001",
                "tenant_org001",
                "evt_notification_31",
                readyRecipientPlan(),
                List.of("email"));

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("providerReadyChannels", List.of())
        .containsEntry("providerBlockedChannels", List.of("email"));
    assertThat((List<Object>) plan.get("providerReadinessFailedChecks"))
        .containsExactly("single_channel_guard_matched");
    assertChannelReady(plan, "email", false);
  }

  private void assertChannelPlans(Map<String, Object> plan, boolean providerSendEnabled) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> channelPlans =
        (List<Map<String, Object>>) plan.get("channelPlans");
    assertThat(channelPlans)
        .allSatisfy(
            channelPlan ->
                assertThat(channelPlan)
                    .containsEntry("providerSendEnabled", providerSendEnabled)
                    .containsEntry("providerCallRequested", false)
                    .containsEntry("providerCallExecuted", false)
                    .containsEntry("sendEnabled", false));
  }

  private void assertChannelReady(
      Map<String, Object> plan, String channel, boolean expectedReady) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> channelPlans =
        (List<Map<String, Object>>) plan.get("channelPlans");
    assertThat(channelPlans)
        .anySatisfy(
            channelPlan ->
                assertThat(channelPlan)
                    .containsEntry("channel", channel)
                    .containsEntry("channelReadyForProviderDryRun", expectedReady)
                    .containsEntry("providerCallExecuted", false)
                    .containsEntry("sendEnabled", false));
  }

  private void assertReadinessMatrix(
      Map<String, Object> plan, String expectedName, boolean expectedPassed) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) plan.get("providerReadinessMatrix");
    assertThat(matrix)
        .anySatisfy(
            check ->
                assertThat(check)
                    .containsEntry("name", expectedName)
                    .containsEntry("passed", expectedPassed));
  }

  private Map<String, Object> readyRecipientPlan() {
    return Map.of(
        "recipientResolutionStatus",
        "preview_only",
        "recipientCount",
        1,
        "recipients",
        List.of(
            Map.of(
                "centerUserId",
                1001,
                "username",
                "owner01",
                "realName",
                "张三",
                "phoneMasked",
                "138****8000",
                "memberRole",
                "owner",
                "recipientScope",
                "organization_owner",
                "channels",
                List.of("in_app", "wechat_work", "sms"))));
  }

  private OrganizationProvisioningCompletedNotificationProviderPlanService service(
      boolean providerSendEnabled) {
    return service(providerSendEnabled, "in_app");
  }

  private OrganizationProvisioningCompletedNotificationProviderPlanService service(
      boolean providerSendEnabled, String channelGuard) {
    AppProperties appProperties = new AppProperties();
    appProperties.getRabbitMq().setOrganizationProvisioningProviderSendEnabled(providerSendEnabled);
    appProperties.getRabbitMq().setOrganizationProvisioningProviderChannelGuard(channelGuard);
    return new OrganizationProvisioningCompletedNotificationProviderPlanService(
        appProperties,
        new OrganizationProvisioningCompletedInAppProviderExecutionPlanService(
            appProperties,
            new OrganizationProvisioningCompletedInAppProviderExecutorPreflightService(),
            new OrganizationProvisioningCompletedInAppNotificationInsertPlanService(),
            new OrganizationProvisioningCompletedInAppDeliveryPlanService(),
            new OrganizationProvisioningCompletedInAppListenerAutoExecutionGatePlanService(
                appProperties,
                new OrganizationProvisioningCompletedInAppListenerAutoExecutionInvocationPlanService())));
  }
}

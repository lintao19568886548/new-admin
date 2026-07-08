package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** in_app provider 执行器前置计划测试；确认只生成写库预案，不执行 SQL。 */
class OrganizationProvisioningCompletedInAppProviderExecutionPlanServiceTest {

  @Test
  void buildPlanPreviewsInAppWriteAndIdempotencyWhenChannelIsReady() {
    Map<String, Object> plan = service(false).buildPlan(providerPlan(true, true));

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_write_plan")
        .containsEntry("channel", "in_app")
        .containsEntry("executorBean", "organizationProvisioningCompletedInAppProviderExecutor")
        .containsEntry(
            "manualExecutionBean",
            "organizationProvisioningCompletedInAppProviderManualExecutionService")
        .containsEntry("providerSendEnabled", true)
        .containsEntry("providerChannelGuard", "in_app")
        .containsEntry("eventId", "evt_notification_31")
        .containsEntry(
            "idempotencyKey", "organization-provisioning-completed-provider:31:in_app")
        .containsEntry("recipientCount", 1)
        .containsEntry("executionRequested", false)
        .containsEntry("executionExecuted", false)
        .containsEntry("manualExecutionRequested", false)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("manualFailureClosureSupported", true)
        .containsEntry("manualFailureClosureExecuted", false)
        .containsEntry("listenerAutoExecution", false)
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushExecuted", false)
        .containsEntry("websocketPushDeliveryPlanned", true)
        .containsEntry("websocketPushDeliveryExecuted", false)
        .containsEntry("dbWriteExecuted", false)
        .containsEntry("smsProviderExecuted", false)
        .containsEntry("weworkProviderExecuted", false)
        .containsEntry(
            "executionBoundary",
            "第 173 批后显式手动入口可串联 claim/insert/markSuccess，insert/markSuccess 异常可按安全门 markFailure；仍不接 listener")
        .containsEntry(
            "nextAction",
            "ready_for_in_app_provider_executor_claim_preflight_but_current_plan_does_not_write");
    assertThat((List<Object>) plan.get("blockedReasons")).isEmpty();

    @SuppressWarnings("unchecked")
    Map<String, Object> writePreview = (Map<String, Object>) plan.get("writePreview");
    assertThat(writePreview)
        .containsEntry("idempotencyTable", "event_consume_log")
        .containsEntry(
            "idempotencyConsumerGroup",
            "provider-in-app-organization-provisioning-completed")
        .containsEntry("idempotencyEventId", "evt_notification_31:in_app")
        .containsEntry("notificationTable", "in_app_notification")
        .containsEntry("notificationTableCreated", false)
        .containsEntry("manualDdlApplied", false)
        .containsEntry("manualDdlRequired", true)
        .containsEntry("statusAfterWrite", "unread");
    assertThat((List<Object>) writePreview.get("recipientWritePreviews"))
        .hasSize(1)
        .anySatisfy(
            preview ->
                assertThat((Map<String, Object>) preview)
                    .containsEntry("centerUserId", 1001)
                    .containsEntry("status", "unread")
                    .containsEntry(
                        "idempotencyKey",
                        "organization-provisioning-completed-provider:31:in_app:1001")
                    .containsEntry("writeExecuted", false));
    assertThat((Map<String, Object>) writePreview.get("notificationInsertPlan"))
        .containsEntry("planStatus", "blocked")
        .containsEntry("insertExecuted", false)
        .containsEntry("dbWriteExecuted", false);
    assertThat((Map<String, Object>) writePreview.get("websocketPushDeliveryPlan"))
        .containsEntry("planStatus", "blocked")
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushExecuted", false)
        .containsEntry("deliveryExecuted", false);
    assertThat((Map<String, Object>) plan.get("listenerAutoExecutionGatePlan"))
        .containsEntry("planStatus", "blocked")
        .containsEntry("listenerAutoExecutionAllowed", false)
        .containsEntry("listenerAutoExecutionExecuted", false)
        .containsEntry("listenerIntegrationExecuted", false);
    assertThat(
            (Map<String, Object>)
                ((Map<String, Object>) plan.get("listenerAutoExecutionGatePlan")).get("invocationPlan"))
        .containsEntry("planStatus", "blocked")
        .containsEntry("manualExecutionExecuted", false);

    @SuppressWarnings("unchecked")
    Map<String, Object> preflight = (Map<String, Object>) plan.get("executorPreflightPlan");
    assertThat(preflight)
        .containsEntry("planStatus", "blocked")
        .containsEntry("claimReady", false)
        .containsEntry("claimExecuted", false)
        .containsEntry("dbWriteExecuted", false)
        .containsEntry("manualDdlApplied", false);
    assertThat((List<Object>) preflight.get("blockedReasons"))
        .containsExactly("in_app_notification 手工 DDL 尚未确认应用");
  }

  @Test
  void buildPlanMarksClaimPreflightReadyOnlyAfterManualDdlIsApplied() {
    Map<String, Object> plan = service(true).buildPlan(providerPlan(true, true));

    @SuppressWarnings("unchecked")
    Map<String, Object> writePreview = (Map<String, Object>) plan.get("writePreview");
    assertThat(writePreview)
        .containsEntry("notificationTableCreated", true)
        .containsEntry("manualDdlApplied", true)
        .containsEntry("manualDdlRequired", false);
    assertThat((Map<String, Object>) writePreview.get("notificationInsertPlan"))
        .containsEntry("planStatus", "ready_for_insert_dry_run")
        .containsEntry("insertRowCount", 1)
        .containsEntry("insertExecuted", false)
        .containsEntry("dbWriteExecuted", false);
    assertThat((Map<String, Object>) writePreview.get("websocketPushDeliveryPlan"))
        .containsEntry("planStatus", "ready_for_delivery_dry_run")
        .containsEntry("deliveryRowCount", 1)
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushExecuted", false);
    assertThat((Map<String, Object>) plan.get("listenerAutoExecutionGatePlan"))
        .containsEntry("planStatus", "blocked")
        .containsEntry("listenerAutoExecutionAllowed", false)
        .containsEntry("listenerAutoExecutionGateEnabled", false);
    assertThat(
            (Map<String, Object>)
                ((Map<String, Object>) plan.get("listenerAutoExecutionGatePlan")).get("invocationPlan"))
        .containsEntry("planStatus", "blocked")
        .containsEntry("listenerInvocationExecuted", false);

    @SuppressWarnings("unchecked")
    Map<String, Object> preflight = (Map<String, Object>) plan.get("executorPreflightPlan");
    assertThat(preflight)
        .containsEntry("planStatus", "ready_for_claim_dry_run")
        .containsEntry("claimReady", true)
        .containsEntry("claimRequested", false)
        .containsEntry("claimExecuted", false)
        .containsEntry("dbWriteExecuted", false)
        .containsEntry(
            "nextAction",
            "ready_for_real_event_consume_log_claim_batch_but_current_preflight_does_not_claim");
    assertThat((List<Object>) preflight.get("blockedReasons")).isEmpty();
    assertThat((Map<String, Object>) preflight.get("eventConsumeLogEntryPreview"))
        .containsEntry(
            "consumerGroup", "provider-in-app-organization-provisioning-completed")
        .containsEntry("eventId", "evt_notification_31:in_app")
        .containsEntry(
            "eventType", "provider.organization.provisioning.completed.in_app_notification")
        .containsEntry(
            "idempotencyKey", "organization-provisioning-completed-provider:31:in_app")
        .containsEntry("topic", "magic.notification.queue")
        .containsEntry("claimExecuted", false);
  }

  @Test
  void buildPlanBlocksWhenInAppIsNotReadyChannel() {
    Map<String, Object> plan = service(false).buildPlan(providerPlan(false, true));

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("executionExecuted", false)
        .containsEntry("dbWriteExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains("in_app 未进入 providerReadyChannels，不能进入写库执行预案");
  }

  @Test
  void buildPlanBlocksWhenChannelPlanIsMissing() {
    Map<String, Object> plan =
        service(false)
            .buildPlan(
                Map.of(
                    "eventId",
                    "evt_notification_31",
                    "providerReadyChannels",
                    List.of("in_app"),
                    "channelPlans",
                    List.of()));

    assertThat(plan).containsEntry("planStatus", "blocked");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "providerPlan 缺少 in_app channelPlan",
            "in_app 没有可写入站内通知的收件人",
            "in_app channelPlan 缺少 idempotencyKey");
  }

  @Test
  void buildPlanBlocksWhenRecipientsAreMissing() {
    Map<String, Object> plan = service(false).buildPlan(providerPlan(true, false));

    assertThat(plan).containsEntry("planStatus", "blocked");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains("in_app 没有可写入站内通知的收件人");
  }

  private Map<String, Object> providerPlan(boolean inAppReady, boolean includeRecipient) {
    return Map.of(
        "jobId",
        31,
        "targetCustomerId",
        "org001",
        "targetDbName",
        "tenant_org001",
        "eventId",
        "evt_notification_31",
        "templateKey",
        OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY,
        "providerSendEnabled",
        true,
        "providerChannelGuard",
        "in_app",
        "providerReadyChannels",
        inAppReady ? List.of("in_app") : List.of(),
        "channelPlans",
        List.of(channelPlan(includeRecipient)));
  }

  private Map<String, Object> channelPlan(boolean includeRecipient) {
    return Map.of(
        "channel",
        "in_app",
        "idempotencyKey",
        "organization-provisioning-completed-provider:31:in_app",
        "recipients",
        includeRecipient
            ? List.of(
                Map.of(
                    "centerUserId",
                    1001,
                    "recipientScope",
                    "organization_owner",
                    "memberRole",
                    "owner"))
            : List.of());
  }

  private OrganizationProvisioningCompletedInAppProviderExecutionPlanService service(
      boolean manualDdlApplied) {
    AppProperties appProperties = new AppProperties();
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppNotificationDdlApplied(manualDdlApplied);
    return new OrganizationProvisioningCompletedInAppProviderExecutionPlanService(
        appProperties,
        new OrganizationProvisioningCompletedInAppProviderExecutorPreflightService(),
        new OrganizationProvisioningCompletedInAppNotificationInsertPlanService(),
        new OrganizationProvisioningCompletedInAppDeliveryPlanService(),
        new OrganizationProvisioningCompletedInAppListenerAutoExecutionGatePlanService(
            appProperties,
            new OrganizationProvisioningCompletedInAppListenerAutoExecutionInvocationPlanService()));
  }
}

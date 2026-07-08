package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** websocket/push 投递预案测试；第 174 批只生成 dry-run，不执行真实推送。 */
class OrganizationProvisioningCompletedInAppDeliveryPlanServiceTest {

  private final OrganizationProvisioningCompletedInAppDeliveryPlanService service =
      new OrganizationProvisioningCompletedInAppDeliveryPlanService();

  @Test
  void buildPlanReturnsReadyDryRunWhenInsertPlanIsReady() {
    Map<String, Object> plan =
        service.buildPlan(executionPlan("ready_for_write_plan"), writePreview(), insertPlan(true));

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_delivery_dry_run")
        .containsEntry("deliveryChannels", List.of("websocket", "push"))
        .containsEntry("deliveryRowCount", 1)
        .containsEntry("websocketRequested", false)
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushRequested", false)
        .containsEntry("pushExecuted", false)
        .containsEntry("deliveryExecuted", false)
        .containsEntry("dbWriteExecuted", false)
        .containsEntry(
            "executionBoundary", "第 174 批只生成 websocket/push 投递 dry-run 计划，不执行真实推送")
        .containsEntry(
            "nextAction",
            "ready_for_websocket_push_provider_batch_but_current_plan_does_not_deliver");
    assertThat((List<Object>) plan.get("blockedReasons")).isEmpty();
    assertThat((List<Object>) plan.get("deliveryRows"))
        .hasSize(1)
        .anySatisfy(
            row ->
                assertThat((Map<String, Object>) row)
                    .containsEntry("recipientCenterUserId", 1001)
                    .containsEntry("targetCustomerId", "org001")
                    .containsEntry("targetDbName", "tenant_org001")
                    .containsEntry("eventId", "evt_notification_31:in_app")
                    .containsEntry(
                        "notificationIdempotencyKey",
                        "organization-provisioning-completed-provider:31:in_app:1001")
                    .containsEntry(
                        "templateKey",
                        OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY)
                    .containsEntry("title", "组织空间开通完成")
                    .containsEntry("content", "您的组织空间已开通完成，请刷新后进入新空间。")
                    .containsEntry("recipientScope", "organization_owner")
                    .containsEntry("memberRole", "owner")
                    .containsEntry("websocketTopic", "user:1001:notifications")
                    .containsEntry("websocketEvent", "in_app_notification.created")
                    .containsEntry("pushTemplateKey", "organization_provisioning_completed_in_app")
                    .containsEntry("websocketExecuted", false)
                    .containsEntry("pushExecuted", false));
  }

  @Test
  void buildPlanBlocksWhenInsertPlanIsNotReady() {
    Map<String, Object> plan =
        service.buildPlan(executionPlan("ready_for_write_plan"), writePreview(), insertPlan(false));

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("notificationInsertPlan 尚未 ready_for_insert_dry_run");
  }

  @Test
  void buildPlanBlocksWhenExecutionPlanIsNotReady() {
    Map<String, Object> plan =
        service.buildPlan(executionPlan("blocked"), writePreview(), insertPlan(true));

    assertThat(plan).containsEntry("planStatus", "blocked");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("in_app executionPlan 尚未 ready_for_write_plan");
  }

  @Test
  void buildPlanBlocksWhenDeliveryFieldsAreMissing() {
    Map<String, Object> plan =
        service.buildPlan(
            executionPlan("ready_for_write_plan"),
            Map.of("recipientWritePreviews", List.of(Map.of("centerUserId", ""))),
            Map.of(
                "planStatus",
                "ready_for_insert_dry_run",
                "insertRows",
                List.of(
                    Map.of(
                        "recipientCenterUserId",
                        "",
                        "idempotencyKey",
                        "",
                        "title",
                        "",
                        "content",
                        ""))));

    assertThat(plan).containsEntry("planStatus", "blocked");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "投递行缺少 recipientCenterUserId",
            "投递行缺少 notificationIdempotencyKey",
            "投递行缺少 title",
            "投递行缺少 content");
  }

  private Map<String, Object> executionPlan(String status) {
    return Map.of(
        "planStatus",
        status,
        "targetCustomerId",
        "org001",
        "targetDbName",
        "tenant_org001");
  }

  private Map<String, Object> writePreview() {
    return Map.of(
        "recipientWritePreviews",
        List.of(
            Map.of(
                "centerUserId",
                1001,
                "recipientScope",
                "organization_owner",
                "memberRole",
                "owner")));
  }

  private Map<String, Object> insertPlan(boolean ready) {
    return Map.of(
        "planStatus",
        ready ? "ready_for_insert_dry_run" : "blocked",
        "insertRows",
        List.of(
            Map.of(
                "eventId",
                "evt_notification_31:in_app",
                "idempotencyKey",
                "organization-provisioning-completed-provider:31:in_app:1001",
                "recipientCenterUserId",
                1001,
                "targetCustomerId",
                "org001",
                "targetDbName",
                "tenant_org001",
                "templateKey",
                OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY,
                "title",
                "组织空间开通完成",
                "content",
                "您的组织空间已开通完成，请刷新后进入新空间。")));
  }
}

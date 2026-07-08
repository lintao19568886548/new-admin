package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** in_app_notification insert 参数预检测试；第 168 批不执行 SQL。 */
class OrganizationProvisioningCompletedInAppNotificationInsertPlanServiceTest {

  private final OrganizationProvisioningCompletedInAppNotificationInsertPlanService service =
      new OrganizationProvisioningCompletedInAppNotificationInsertPlanService();

  @Test
  void buildPlanReturnsReadyDryRunWhenAllInsertFieldsArePresent() {
    Map<String, Object> plan = service.buildPlan(executionPlan(), writePreview(true, true));

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_insert_dry_run")
        .containsEntry("tableName", "in_app_notification")
        .containsEntry("insertRowCount", 1)
        .containsEntry("manualDdlApplied", true)
        .containsEntry("insertRequested", false)
        .containsEntry("insertExecuted", false)
        .containsEntry("dbWriteExecuted", false)
        .containsEntry(
            "executionBoundary", "第 168 批只生成 in_app_notification insert 参数预检，不执行 SQL")
        .containsEntry(
            "nextAction",
            "ready_for_in_app_notification_insert_repository_batch_but_current_plan_does_not_insert");
    assertThat((List<Object>) plan.get("blockedReasons")).isEmpty();
    assertThat((List<Object>) plan.get("insertColumns"))
        .containsExactly(
            "event_id",
            "idempotency_key",
            "recipient_center_user_id",
            "target_customer_id",
            "target_db_name",
            "template_key",
            "title",
            "content",
            "status",
            "payload_json");
    assertThat((List<Object>) plan.get("insertRows"))
        .hasSize(1)
        .anySatisfy(
            row ->
                assertThat((Map<String, Object>) row)
                    .containsEntry("eventId", "evt_notification_31:in_app")
                    .containsEntry(
                        "idempotencyKey",
                        "organization-provisioning-completed-provider:31:in_app:1001")
                    .containsEntry("recipientCenterUserId", 1001)
                    .containsEntry("targetCustomerId", "org001")
                    .containsEntry("targetDbName", "tenant_org001")
                    .containsEntry(
                        "templateKey",
                        OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY)
                    .containsEntry("title", "组织空间开通完成")
                    .containsEntry("content", "您的组织空间已开通完成，请刷新后进入新空间。")
                    .containsEntry("status", "unread")
                    .containsEntry("insertExecuted", false));
  }

  @Test
  void buildPlanBlocksWhenManualDdlIsNotConfirmed() {
    Map<String, Object> plan = service.buildPlan(executionPlan(), writePreview(false, true));

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("manualDdlApplied", false)
        .containsEntry("insertExecuted", false)
        .containsEntry("dbWriteExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("in_app_notification 手工 DDL 尚未确认应用");
  }

  @Test
  void buildPlanBlocksWhenRecipientInsertFieldsAreMissing() {
    Map<String, Object> plan = service.buildPlan(executionPlan(), writePreview(true, false));

    assertThat(plan).containsEntry("planStatus", "blocked");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "insert 行缺少 idempotencyKey",
            "insert 行缺少 recipientCenterUserId",
            "insert 行缺少 title",
            "insert 行缺少 content");
  }

  private Map<String, Object> executionPlan() {
    return Map.of(
        "planStatus",
        "ready_for_write_plan",
        "jobId",
        31,
        "targetCustomerId",
        "org001",
        "targetDbName",
        "tenant_org001");
  }

  private Map<String, Object> writePreview(boolean manualDdlApplied, boolean validRecipient) {
    return Map.of(
        "manualDdlApplied",
        manualDdlApplied,
        "idempotencyEventId",
        "evt_notification_31:in_app",
        "templateKey",
        OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY,
        "recipientWritePreviews",
        List.of(recipientPreview(validRecipient)));
  }

  private Map<String, Object> recipientPreview(boolean validRecipient) {
    if (validRecipient) {
      return Map.of(
          "centerUserId",
          1001,
          "recipientScope",
          "organization_owner",
          "memberRole",
          "owner",
          "title",
          "组织空间开通完成",
          "contentTemplate",
          "您的组织空间已开通完成，请刷新后进入新空间。",
          "status",
          "unread",
          "idempotencyKey",
          "organization-provisioning-completed-provider:31:in_app:1001");
    }
    return Map.of(
        "centerUserId",
        "",
        "status",
        "unread",
        "idempotencyKey",
        "");
  }
}

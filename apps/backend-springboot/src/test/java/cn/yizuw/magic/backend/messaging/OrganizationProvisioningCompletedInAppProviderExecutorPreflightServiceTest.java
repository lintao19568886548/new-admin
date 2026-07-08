package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** in_app provider 执行器 claim 预检测试；确认第 166 批不执行真实 claim。 */
class OrganizationProvisioningCompletedInAppProviderExecutorPreflightServiceTest {

  private final OrganizationProvisioningCompletedInAppProviderExecutorPreflightService service =
      new OrganizationProvisioningCompletedInAppProviderExecutorPreflightService();

  @Test
  void buildPreflightReturnsReadyDryRunWhenPlanAndDdlAreReady() {
    Map<String, Object> preflight = service.buildPreflight(executionPlan(true, true));

    assertThat(preflight)
        .containsEntry("planStatus", "ready_for_claim_dry_run")
        .containsEntry("channel", "in_app")
        .containsEntry("eventId", "evt_notification_31:in_app")
        .containsEntry(
            "idempotencyKey", "organization-provisioning-completed-provider:31:in_app")
        .containsEntry(
            "consumerGroup", "provider-in-app-organization-provisioning-completed")
        .containsEntry(
            "eventType", "provider.organization.provisioning.completed.in_app_notification")
        .containsEntry("topic", "magic.notification.queue")
        .containsEntry("recipientWritePreviewCount", 1)
        .containsEntry("manualDdlApplied", true)
        .containsEntry("claimReady", true)
        .containsEntry("claimRequested", false)
        .containsEntry("claimExecuted", false)
        .containsEntry("dbWriteExecuted", false)
        .containsEntry("markSuccessExecuted", false)
        .containsEntry("markFailureExecuted", false);
    assertThat((List<Object>) preflight.get("blockedReasons")).isEmpty();
    assertThat((Map<String, Object>) preflight.get("eventConsumeLogEntryPreview"))
        .containsEntry("type", "EventConsumeLogEntry")
        .containsEntry(
            "consumerGroup", "provider-in-app-organization-provisioning-completed")
        .containsEntry("eventId", "evt_notification_31:in_app")
        .containsEntry(
            "eventType", "provider.organization.provisioning.completed.in_app_notification")
        .containsEntry("topic", "magic.notification.queue")
        .containsEntry("claimExecuted", false);
  }

  @Test
  void buildPreflightBlocksWhenManualDdlIsNotConfirmed() {
    Map<String, Object> preflight = service.buildPreflight(executionPlan(false, true));

    assertThat(preflight)
        .containsEntry("planStatus", "blocked")
        .containsEntry("manualDdlApplied", false)
        .containsEntry("claimReady", false)
        .containsEntry("claimExecuted", false)
        .containsEntry("dbWriteExecuted", false);
    assertThat((List<Object>) preflight.get("blockedReasons"))
        .containsExactly("in_app_notification 手工 DDL 尚未确认应用");
  }

  @Test
  void buildPreflightBlocksWhenRecipientPreviewIsInvalid() {
    Map<String, Object> preflight = service.buildPreflight(executionPlan(true, false));

    assertThat(preflight).containsEntry("planStatus", "blocked");
    assertThat((List<Object>) preflight.get("blockedReasons"))
        .contains("recipientWritePreviews 存在缺少 centerUserId 或 idempotencyKey 的行");
  }

  private Map<String, Object> executionPlan(boolean manualDdlApplied, boolean validRecipient) {
    return Map.of(
        "planStatus",
        "ready_for_write_plan",
        "executorBean",
        "organizationProvisioningCompletedInAppProviderExecutor",
        "writePreview",
        Map.of(
            "idempotencyConsumerGroup",
            "provider-in-app-organization-provisioning-completed",
            "idempotencyEventId",
            "evt_notification_31:in_app",
            "idempotencyKey",
            "organization-provisioning-completed-provider:31:in_app",
            "manualDdlApplied",
            manualDdlApplied,
            "recipientWritePreviews",
            List.of(recipientPreview(validRecipient))));
  }

  private Map<String, Object> recipientPreview(boolean validRecipient) {
    if (validRecipient) {
      return Map.of(
          "centerUserId",
          1001,
          "idempotencyKey",
          "organization-provisioning-completed-provider:31:in_app:1001");
    }
    return Map.of("centerUserId", "", "idempotencyKey", "");
  }
}

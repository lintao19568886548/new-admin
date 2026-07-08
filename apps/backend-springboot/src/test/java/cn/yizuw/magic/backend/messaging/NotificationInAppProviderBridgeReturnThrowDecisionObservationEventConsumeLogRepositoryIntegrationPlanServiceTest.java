package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService
      service =
          new NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService();

  @Test
  void buildPlanPreviewsRepositoryIntegrationWhenWritePlanAndMetadataAreReady() {
    Map<String, Object> plan = service.buildPlan(readyWritePlan(), readyMetadataPlan());

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_event_consume_log_repository_integration")
        .containsEntry("planStatus", "ready_for_event_consume_log_repository_integration_dry_run")
        .containsEntry("eventConsumeLogWritePlanProvided", true)
        .containsEntry("databaseWritePlanned", true)
        .containsEntry("targetTableReady", true)
        .containsEntry("eventMetadataProvided", true)
        .containsEntry("eventMetadataReady", true)
        .containsEntry("repositoryIntegrationPlanned", true)
        .containsEntry("repositoryClassPreview", "EventConsumeLogRepository")
        .containsEntry("repositoryMethodPreview", "recordSuccess(EventConsumeLogEntry)")
        .containsEntry(
            "nextAction",
            "ready_for_future_event_consume_log_repository_dry_run_listener_integration_batch");
    assertThat(mapValue(plan.get("eventConsumeLogEntryPreview")))
        .containsEntry("type", "EventConsumeLogEntry")
        .containsEntry("consumerGroup", "notification-in-app-provider-observation")
        .containsEntry("eventId", "evt_notification_31")
        .containsEntry("eventType", "organization_provisioning_completed")
        .containsEntry("idempotencyKey", "organization-provisioning-completed-notification:31")
        .containsEntry("topic", "magic.notification.queue");
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertNoSideEffects(plan);
  }

  @Test
  void buildPlanBlocksUntilWritePlanAndMetadataAreReady() {
    assertBlocked(
        service.buildPlan(Map.of(), readyMetadataPlan()),
        "event_consume_log write plan 缺失，不能规划 repository 集成");
    assertBlocked(
        service.buildPlan(
            Map.of("databaseWritePlanned", false, "targetTable", "event_consume_log"),
            readyMetadataPlan()),
        "databaseWritePlanned=false，不能规划 repository 集成");
    assertBlocked(
        service.buildPlan(
            Map.of("databaseWritePlanned", true, "targetTable", "in_app_notification"),
            readyMetadataPlan()),
        "targetTable 不是 event_consume_log，不能规划 repository 集成");
    assertBlocked(
        service.buildPlan(readyWritePlan(), Map.of("eventId", "evt_notification_31")),
        "event metadata 缺失，不能构造 EventConsumeLogEntry 预览");
  }

  @Test
  void sourceDoesNotInvokeRepositoryOrExecuteSqlBeforeListenerIntegration() throws IOException {
    String source =
        Files.readString(
            Path.of(
                "src/main/java/cn/yizuw/magic/backend/messaging/"
                    + "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService.java"));

    assertThat(source)
        .contains("repositoryIntegrationPlanned")
        .contains("EventConsumeLogEntry")
        .contains("EventConsumeLogRepository")
        .doesNotContain("eventConsumeLogRepository")
        .doesNotContain("JdbcTemplate")
        .doesNotContain("@Transactional")
        .doesNotContain(".recordSuccess(")
        .doesNotContain(".claimProcessing(")
        .doesNotContain(".markSuccess(")
        .doesNotContain(".markFailure(")
        .doesNotContain(".insert")
        .doesNotContain(".save(")
        .doesNotContain(".update(")
        .doesNotContain("execute(")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  private Map<String, Object> readyWritePlan() {
    return Map.of("databaseWritePlanned", true, "targetTable", "event_consume_log");
  }

  private Map<String, Object> readyMetadataPlan() {
    return Map.of(
        "consumerGroup",
        "notification-in-app-provider-observation",
        "eventId",
        "evt_notification_31",
        "eventType",
        "organization_provisioning_completed",
        "idempotencyKey",
        "organization-provisioning-completed-notification:31",
        "topic",
        "magic.notification.queue");
  }

  private void assertBlocked(Map<String, Object> plan, String expectedReason) {
    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("repositoryIntegrationPlanned", false)
        .containsEntry("repositoryClassPreview", "")
        .containsEntry("repositoryMethodPreview", "")
        .containsEntry(
            "nextAction", "keep_repository_integration_blocked_until_write_plan_and_metadata_ready");
    assertThat(mapValue(plan.get("eventConsumeLogEntryPreview"))).isEmpty();
    assertThat(stringList(plan.get("blockedReasons"))).contains(expectedReason);
    assertNoSideEffects(plan);
  }

  private void assertNoSideEffects(Map<String, Object> plan) {
    assertThat(plan)
        .containsEntry("repositoryInvoked", false)
        .containsEntry("databaseWriteExecuted", false)
        .containsEntry("sqlExecuted", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("decisionApplied", false)
        .containsEntry("throwRequested", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("rabbitRejectExecuted", false);
  }

  private Map<String, Object> mapValue(Object value) {
    if (value instanceof Map<?, ?> map) {
      return map.entrySet().stream()
          .collect(
              java.util.stream.Collectors.toMap(
                  entry -> String.valueOf(entry.getKey()),
                  Map.Entry::getValue,
                  (left, right) -> right,
                  java.util.LinkedHashMap::new));
    }
    return Map.of();
  }

  private List<String> stringList(Object value) {
    if (value instanceof List<?> list) {
      return list.stream().map(String::valueOf).toList();
    }
    return List.of();
  }
}

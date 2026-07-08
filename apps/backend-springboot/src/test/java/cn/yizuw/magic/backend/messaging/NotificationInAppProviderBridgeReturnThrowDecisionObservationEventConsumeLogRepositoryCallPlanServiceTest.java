package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService
      service =
          new NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService();

  @Test
  void buildPlanPreviewsRepositoryCallWhenIntegrationPlanIsReady() {
    Map<String, Object> plan = service.buildPlan(readyRepositoryIntegrationPlan());

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_event_consume_log_repository_call")
        .containsEntry("planStatus", "ready_for_event_consume_log_repository_call_dry_run")
        .containsEntry("repositoryIntegrationPlanProvided", true)
        .containsEntry("repositoryIntegrationReady", true)
        .containsEntry("repositoryClassReady", true)
        .containsEntry("repositoryMethodReady", true)
        .containsEntry("eventConsumeLogEntryReady", true)
        .containsEntry("repositoryCallPlanned", true)
        .containsEntry("repositoryBeanPreview", "EventConsumeLogRepository")
        .containsEntry("repositoryMethodPreview", "recordSuccess")
        .containsEntry(
            "nextAction", "ready_for_future_event_consume_log_repository_execution_gate_batch");
    assertThat(mapValue(plan.get("repositoryArgumentPreview")))
        .containsEntry("type", "EventConsumeLogEntry")
        .containsEntry("consumerGroup", "notification-in-app-provider-observation")
        .containsEntry("eventId", "evt_notification_31")
        .containsEntry("eventType", "organization_provisioning_completed")
        .containsEntry("idempotencyKey", "organization-provisioning-completed-notification:31")
        .containsEntry("topic", "magic.notification.queue");
    assertThat(stringList(plan.get("repositoryInvocationOrderPreview")))
        .containsExactly(
            "build EventConsumeLogEntry",
            "call EventConsumeLogRepository.recordSuccess",
            "ignore inserted result until listener execution gate");
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertNoSideEffects(plan);
  }

  @Test
  void buildPlanBlocksUntilRepositoryIntegrationPlanIsReady() {
    assertBlocked(
        service.buildPlan(Map.of()),
        "repository integration plan 缺失，不能规划 repository 调用");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "repositoryIntegrationPlanned",
                false,
                "repositoryClassPreview",
                "EventConsumeLogRepository",
                "repositoryMethodPreview",
                "recordSuccess(EventConsumeLogEntry)",
                "eventConsumeLogEntryPreview",
                readyEntryPreview())),
        "repositoryIntegrationPlanned=false，不能规划 repository 调用");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "repositoryIntegrationPlanned",
                true,
                "repositoryClassPreview",
                "JdbcTemplate",
                "repositoryMethodPreview",
                "recordSuccess(EventConsumeLogEntry)",
                "eventConsumeLogEntryPreview",
                readyEntryPreview())),
        "repositoryClassPreview 不是 EventConsumeLogRepository");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "repositoryIntegrationPlanned",
                true,
                "repositoryClassPreview",
                "EventConsumeLogRepository",
                "repositoryMethodPreview",
                "markSuccess(EventConsumeLogEntry)",
                "eventConsumeLogEntryPreview",
                readyEntryPreview())),
        "repositoryMethodPreview 不是 recordSuccess(EventConsumeLogEntry)");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "repositoryIntegrationPlanned",
                true,
                "repositoryClassPreview",
                "EventConsumeLogRepository",
                "repositoryMethodPreview",
                "recordSuccess(EventConsumeLogEntry)",
                "eventConsumeLogEntryPreview",
                Map.of("eventId", "evt_notification_31"))),
        "eventConsumeLogEntryPreview 缺失，不能构造 repository 调用参数");
  }

  @Test
  void sourceDoesNotInvokeRepositoryOrExecuteSqlBeforeExecutionGate() throws IOException {
    String source =
        Files.readString(
            Path.of(
                "src/main/java/cn/yizuw/magic/backend/messaging/"
                    + "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService.java"));

    assertThat(source)
        .contains("repositoryCallPlanned")
        .contains("EventConsumeLogRepository")
        .contains("recordSuccess")
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

  private Map<String, Object> readyRepositoryIntegrationPlan() {
    return Map.of(
        "repositoryIntegrationPlanned",
        true,
        "repositoryClassPreview",
        "EventConsumeLogRepository",
        "repositoryMethodPreview",
        "recordSuccess(EventConsumeLogEntry)",
        "eventConsumeLogEntryPreview",
        readyEntryPreview());
  }

  private Map<String, Object> readyEntryPreview() {
    return Map.of(
        "type",
        "EventConsumeLogEntry",
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
        .containsEntry("repositoryCallPlanned", false)
        .containsEntry("repositoryBeanPreview", "")
        .containsEntry("repositoryMethodPreview", "")
        .containsEntry(
            "nextAction", "keep_repository_call_blocked_until_repository_integration_plan_ready");
    assertThat(mapValue(plan.get("repositoryArgumentPreview"))).isEmpty();
    assertThat(stringList(plan.get("repositoryInvocationOrderPreview"))).isEmpty();
    assertThat(stringList(plan.get("blockedReasons"))).contains(expectedReason);
    assertNoSideEffects(plan);
  }

  private void assertNoSideEffects(Map<String, Object> plan) {
    assertThat(plan)
        .containsEntry("insertedResultObserved", false)
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

package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService
      service =
          new NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService();

  @Test
  void buildPlanPreviewsRecordSuccessExecutionWhenCallPlanAndGateAreReady() {
    Map<String, Object> plan =
        service.buildPlan(
            readyRepositoryCallPlan(), Map.of("recordSuccessExecutionAllowed", true));

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_event_consume_log_record_success_execution_gate")
        .containsEntry("planStatus", "ready_for_record_success_execution_dry_run")
        .containsEntry("repositoryCallPlanProvided", true)
        .containsEntry("repositoryCallReady", true)
        .containsEntry("repositoryBeanReady", true)
        .containsEntry("repositoryMethodReady", true)
        .containsEntry("repositoryArgumentReady", true)
        .containsEntry("executionGateProvided", true)
        .containsEntry("recordSuccessExecutionAllowed", true)
        .containsEntry("recordSuccessExecutionPlanned", true)
        .containsEntry("repositoryBeanPreview", "EventConsumeLogRepository")
        .containsEntry("repositoryMethodPreview", "recordSuccess")
        .containsEntry(
            "nextAction",
            "ready_for_future_event_consume_log_record_success_listener_integration_batch");
    assertThat(mapValue(plan.get("repositoryArgumentPreview")))
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
  void buildPlanBlocksUntilCallPlanAndGateAreReady() {
    assertBlocked(
        service.buildPlan(Map.of(), Map.of("recordSuccessExecutionAllowed", true)),
        "repository call plan 缺失，不能规划 recordSuccess 执行");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "repositoryCallPlanned",
                false,
                "repositoryBeanPreview",
                "EventConsumeLogRepository",
                "repositoryMethodPreview",
                "recordSuccess",
                "repositoryArgumentPreview",
                readyArgumentPreview()),
            Map.of("recordSuccessExecutionAllowed", true)),
        "repositoryCallPlanned=false，不能规划 recordSuccess 执行");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "repositoryCallPlanned",
                true,
                "repositoryBeanPreview",
                "JdbcTemplate",
                "repositoryMethodPreview",
                "recordSuccess",
                "repositoryArgumentPreview",
                readyArgumentPreview()),
            Map.of("recordSuccessExecutionAllowed", true)),
        "repositoryBeanPreview 不是 EventConsumeLogRepository");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "repositoryCallPlanned",
                true,
                "repositoryBeanPreview",
                "EventConsumeLogRepository",
                "repositoryMethodPreview",
                "markSuccess",
                "repositoryArgumentPreview",
                readyArgumentPreview()),
            Map.of("recordSuccessExecutionAllowed", true)),
        "repositoryMethodPreview 不是 recordSuccess");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "repositoryCallPlanned",
                true,
                "repositoryBeanPreview",
                "EventConsumeLogRepository",
                "repositoryMethodPreview",
                "recordSuccess",
                "repositoryArgumentPreview",
                Map.of("eventId", "evt_notification_31")),
            Map.of("recordSuccessExecutionAllowed", true)),
        "repositoryArgumentPreview 缺失，不能构造 recordSuccess 参数");
    assertBlocked(
        service.buildPlan(
            readyRepositoryCallPlan(), Map.of("recordSuccessExecutionAllowed", false)),
        "recordSuccess execution gate 尚未开启");
  }

  @Test
  void sourceDoesNotInvokeRepositoryOrExecuteSqlBeforeListenerIntegration()
      throws IOException {
    String source =
        Files.readString(
            Path.of(
                "src/main/java/cn/yizuw/magic/backend/messaging/"
                    + "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService.java"));

    assertThat(source)
        .contains("recordSuccessExecutionPlanned")
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

  private Map<String, Object> readyRepositoryCallPlan() {
    return Map.of(
        "repositoryCallPlanned",
        true,
        "repositoryBeanPreview",
        "EventConsumeLogRepository",
        "repositoryMethodPreview",
        "recordSuccess",
        "repositoryArgumentPreview",
        readyArgumentPreview());
  }

  private Map<String, Object> readyArgumentPreview() {
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
        .containsEntry("recordSuccessExecutionPlanned", false)
        .containsEntry("repositoryBeanPreview", "")
        .containsEntry("repositoryMethodPreview", "")
        .containsEntry(
            "nextAction", "keep_record_success_execution_blocked_until_call_plan_and_gate_ready");
    assertThat(mapValue(plan.get("repositoryArgumentPreview"))).isEmpty();
    assertThat(stringList(plan.get("blockedReasons"))).contains(expectedReason);
    assertNoSideEffects(plan);
  }

  private void assertNoSideEffects(Map<String, Object> plan) {
    assertThat(plan)
        .containsEntry("repositoryInvoked", false)
        .containsEntry("insertedResultObserved", false)
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

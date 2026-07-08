package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class
    NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService
      service =
          new NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService();

  @Test
  void buildPlanPreviewsRecordSuccessExecutionWhenSwitchAndAdapterAreReady() {
    Map<String, Object> plan =
        service.buildPlan(readyExecutionSwitchPlan(), readyExecutionAdapterPlan());

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_event_consume_log_record_success_execution_adapter")
        .containsEntry("planStatus", "ready_for_record_success_execution_adapter_listener_dry_run")
        .containsEntry("executionSwitchPlanProvided", true)
        .containsEntry("recordSuccessExecutionSwitchReady", true)
        .containsEntry("recordSuccessExecutionPlanned", true)
        .containsEntry("recordSuccessExecutionAdapterPlanned", true)
        .containsEntry("executionAdapterPlanProvided", true)
        .containsEntry("recordSuccessExecutionAdapterAllowed", true)
        .containsEntry("recordSuccessExecutionListenerPlanned", true)
        .containsEntry("repositoryBeanPreview", "EventConsumeLogRepository")
        .containsEntry("repositoryMethodPreview", "recordSuccess")
        .containsEntry("nextAction", "ready_for_future_record_success_execution_listener_batch")
        .containsEntry("repositoryInvoked", false)
        .containsEntry("insertedResultObserved", false)
        .containsEntry("databaseWriteExecuted", false)
        .containsEntry("sqlExecuted", false)
        .containsEntry("manualExecutionAllowed", false);
    assertThat(mapValue(plan.get("repositoryArgumentPreview")))
        .containsEntry("type", "EventConsumeLogEntry")
        .containsEntry("eventId", "evt_notification_31");
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertNoSideEffects(plan);
  }

  @Test
  void buildPlanBlocksUntilSwitchAndAdapterAreReady() {
    assertBlocked(
        service.buildPlan(Map.of(), readyExecutionAdapterPlan()),
        "recordSuccess execution switch plan 缺失，不能规划 execution adapter");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "planStatus",
                "blocked",
                "recordSuccessExecutionPlanned",
                true,
                "recordSuccessExecutionAdapterPlanned",
                true,
                "executionAdapterPlanProvided",
                true,
                "repositoryBeanPreview",
                "EventConsumeLogRepository",
                "repositoryMethodPreview",
                "recordSuccess",
                "repositoryArgumentPreview",
                readyArgumentPreview()),
            readyExecutionAdapterPlan()),
        "execution switch plan 尚未 ready");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "planStatus",
                "ready_for_record_success_execution_adapter_dry_run",
                "recordSuccessExecutionPlanned",
                false,
                "recordSuccessExecutionAdapterPlanned",
                true,
                "executionAdapterPlanProvided",
                true,
                "repositoryBeanPreview",
                "EventConsumeLogRepository",
                "repositoryMethodPreview",
                "recordSuccess",
                "repositoryArgumentPreview",
                readyArgumentPreview()),
            readyExecutionAdapterPlan()),
        "recordSuccessExecutionPlanned=false，不能进入 execution adapter");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "planStatus",
                "ready_for_record_success_execution_adapter_dry_run",
                "recordSuccessExecutionPlanned",
                true,
                "recordSuccessExecutionAdapterPlanned",
                false,
                "executionAdapterPlanProvided",
                true,
                "repositoryBeanPreview",
                "EventConsumeLogRepository",
                "repositoryMethodPreview",
                "recordSuccess",
                "repositoryArgumentPreview",
                readyArgumentPreview()),
            readyExecutionAdapterPlan()),
        "recordSuccessExecutionAdapterPlanned=false，不能进入 execution adapter");
    assertBlocked(
        service.buildPlan(
            readyExecutionSwitchPlan(),
            Map.of("recordSuccessExecutionAdapterProperty", "wrong", "recordSuccessExecutionAdapterAllowed", true)),
        "recordSuccess execution adapter property 与预期不匹配");
    assertBlocked(
        service.buildPlan(
            readyExecutionSwitchPlan(), Map.of()),
        "recordSuccess execution adapter 尚未开启");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "planStatus",
                "ready_for_record_success_execution_adapter_dry_run",
                "recordSuccessExecutionPlanned",
                true,
                "recordSuccessExecutionAdapterPlanned",
                true,
                "repositoryBeanPreview",
                "JdbcTemplate",
                "repositoryMethodPreview",
                "recordSuccess",
                "repositoryArgumentPreview",
                readyArgumentPreview()),
            readyExecutionAdapterPlan()),
        "repositoryBeanPreview 不是 EventConsumeLogRepository");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "planStatus",
                "ready_for_record_success_execution_adapter_dry_run",
                "recordSuccessExecutionPlanned",
                true,
                "recordSuccessExecutionAdapterPlanned",
                true,
                "repositoryBeanPreview",
                "EventConsumeLogRepository",
                "repositoryMethodPreview",
                "insert",
                "repositoryArgumentPreview",
                readyArgumentPreview()),
            readyExecutionAdapterPlan()),
        "repositoryMethodPreview 不是 recordSuccess");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "planStatus",
                "ready_for_record_success_execution_adapter_dry_run",
                "recordSuccessExecutionPlanned",
                true,
                "recordSuccessExecutionAdapterPlanned",
                true,
                "repositoryBeanPreview",
                "EventConsumeLogRepository",
                "repositoryMethodPreview",
                "recordSuccess",
                "repositoryArgumentPreview",
                Map.of("eventId", "evt_notification_31")),
            readyExecutionAdapterPlan()),
        "repositoryArgumentPreview 缺失，不能构造 recordSuccess 参数");
  }

  @Test
  void sourceDoesNotReadEnvironmentOrInvokeRepositoryBeforeListenerIntegration() throws IOException {
    String source =
        Files.readString(
            Path.of(
                "src/main/java/cn/yizuw/magic/backend/messaging/"
                    + "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService.java"));

    assertThat(source)
        .contains("recordSuccessExecutionAdapterPlanned")
        .contains("RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ADAPTER_ENABLED")
        .contains("recordSuccessExecutionAdapterAllowed")
        .doesNotContain("System.getenv")
        .doesNotContain("@Value")
        .doesNotContain("Environment")
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

  private Map<String, Object> readyExecutionSwitchPlan() {
    return Map.of(
        "planStatus",
        "ready_for_record_success_execution_adapter_dry_run",
        "recordSuccessExecutionPlanned",
        true,
        "recordSuccessExecutionAdapterPlanned",
        true,
        "executionAdapterPlanProvided",
        true,
        "repositoryBeanPreview",
        "EventConsumeLogRepository",
        "repositoryMethodPreview",
        "recordSuccess",
        "repositoryArgumentPreview",
        readyArgumentPreview());
  }

  private Map<String, Object> readyExecutionAdapterPlan() {
    return Map.of(
        "recordSuccessExecutionAdapterProperty",
        "RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ADAPTER_ENABLED",
        "recordSuccessExecutionAdapterAllowed",
        true);
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
        .containsEntry("recordSuccessExecutionListenerPlanned", false)
        .containsEntry("repositoryBeanPreview", "")
        .containsEntry("repositoryMethodPreview", "")
        .containsEntry(
            "nextAction", "keep_record_success_execution_adapter_blocked_until_execution_switch_and_adapter_ready");
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

package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService
      service =
          new NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService();

  @Test
  void buildPlanPreviewsExecutionAdapterWhenGateAndExplicitSwitchAreReady() {
    Map<String, Object> plan = service.buildPlan(readyGatePlan(), readySwitchPlan());

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_event_consume_log_record_success_execution_switch")
        .containsEntry("planStatus", "ready_for_record_success_execution_adapter_dry_run")
        .containsEntry("recordSuccessExecutionGatePlanProvided", true)
        .containsEntry("recordSuccessExecutionGateReady", true)
        .containsEntry("recordSuccessExecutionPlanned", true)
        .containsEntry("recordSuccessExecutionSwitchProvided", true)
        .containsEntry(
            "recordSuccessExecutionSwitchPropertyExpected",
            "RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED")
        .containsEntry(
            "recordSuccessExecutionSwitchPropertyPreview",
            "RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED")
        .containsEntry("recordSuccessExecutionSwitchPropertyReady", true)
        .containsEntry("recordSuccessExecutionSwitchAllowed", true)
        .containsEntry("recordSuccessExecutionAdapterPlanned", true)
        .containsEntry("repositoryBeanPreview", "EventConsumeLogRepository")
        .containsEntry("repositoryMethodPreview", "recordSuccess")
        .containsEntry(
            "nextAction",
            "ready_for_future_event_consume_log_record_success_execution_adapter_batch");
    assertThat(mapValue(plan.get("repositoryArgumentPreview")))
        .containsEntry("type", "EventConsumeLogEntry")
        .containsEntry("eventId", "evt_notification_31");
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertNoSideEffects(plan);
  }

  @Test
  void buildPlanBlocksUntilGateAndExplicitSwitchAreReady() {
    assertBlocked(
        service.buildPlan(Map.of(), readySwitchPlan()),
        "recordSuccess execution gate plan 缺失");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "planStatus",
                "blocked",
                "recordSuccessExecutionPlanned",
                true,
                "repositoryArgumentPreview",
                readyArgumentPreview()),
            readySwitchPlan()),
        "recordSuccess execution gate 尚未 ready");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "planStatus",
                "ready_for_record_success_execution_dry_run",
                "recordSuccessExecutionPlanned",
                false,
                "repositoryArgumentPreview",
                readyArgumentPreview()),
            readySwitchPlan()),
        "recordSuccessExecutionPlanned=false，不能进入执行适配预案");
    assertBlocked(
        service.buildPlan(readyGatePlan(), Map.of()),
        "recordSuccess execution switch plan 缺失");
    assertBlocked(
        service.buildPlan(
            readyGatePlan(),
            Map.of(
                "recordSuccessExecutionSwitchProperty",
                "RABBITMQ_NOTIFICATION_DISPATCH_ENABLED",
                "recordSuccessExecutionSwitchAllowed",
                true)),
        "recordSuccess execution switch property 未匹配预期显式开关");
    assertBlocked(
        service.buildPlan(
            readyGatePlan(),
            Map.of(
                "recordSuccessExecutionSwitchProperty",
                "RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED",
                "recordSuccessExecutionSwitchAllowed",
                false)),
        "recordSuccess execution switch 尚未开启");
  }

  @Test
  void sourceDoesNotReadEnvironmentOrInvokeRepositoryBeforeAdapterIntegration()
      throws IOException {
    String source =
        Files.readString(
            Path.of(
                "src/main/java/cn/yizuw/magic/backend/messaging/"
                    + "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService.java"));

    assertThat(source)
        .contains("recordSuccessExecutionAdapterPlanned")
        .contains("RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED")
        .contains("EventConsumeLogRepository")
        .contains("recordSuccess")
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

  private Map<String, Object> readyGatePlan() {
    return Map.of(
        "planStatus",
        "ready_for_record_success_execution_dry_run",
        "recordSuccessExecutionPlanned",
        true,
        "repositoryArgumentPreview",
        readyArgumentPreview());
  }

  private Map<String, Object> readySwitchPlan() {
    return Map.of(
        "recordSuccessExecutionSwitchProperty",
        "RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED",
        "recordSuccessExecutionSwitchAllowed",
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
        .containsEntry("recordSuccessExecutionAdapterPlanned", false)
        .containsEntry("repositoryBeanPreview", "")
        .containsEntry("repositoryMethodPreview", "")
        .containsEntry(
            "nextAction", "keep_record_success_execution_blocked_until_explicit_switch_ready");
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

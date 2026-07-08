package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService
      service =
          new NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService();

  @Test
  void buildPlanPreviewsEventConsumeLogWriteWhenLoggerPlanAndGateAreReady() {
    Map<String, Object> plan =
        service.buildPlan(
            readyLoggerExecutionPlan(), Map.of("eventConsumeLogWriteAllowed", true));

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_event_consume_log_write")
        .containsEntry("planStatus", "ready_for_observation_event_consume_log_write_dry_run")
        .containsEntry("loggerExecutionPlanProvided", true)
        .containsEntry("loggerExecutionPlanned", true)
        .containsEntry("formattedMessagePreviewAvailable", true)
        .containsEntry("eventConsumeLogWriteAllowed", true)
        .containsEntry("targetTable", "event_consume_log")
        .containsEntry("writeMode", "future_observation_log_insert_or_update")
        .containsEntry("messageSource", "formattedMessagePreview")
        .containsEntry("formattedMessagePreview", "would persist observation log")
        .containsEntry("databaseWriteRequested", true)
        .containsEntry("databaseWritePlanned", true)
        .containsEntry(
            "nextAction", "ready_for_future_event_consume_log_repository_integration_batch");
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertNoSideEffects(plan);
  }

  @Test
  void buildPlanBlocksUntilLoggerExecutionPlanAndWriteGateAreReady() {
    assertBlocked(
        service.buildPlan(Map.of(), Map.of("eventConsumeLogWriteAllowed", true)),
        "logger execution plan 缺失，不能规划 event_consume_log 写入");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "loggerExecutionPlanned",
                false,
                "formattedMessagePreview",
                "would persist observation log"),
            Map.of("eventConsumeLogWriteAllowed", true)),
        "loggerExecutionPlanned=false，不能规划 event_consume_log 写入");
    assertBlocked(
        service.buildPlan(
            Map.of("loggerExecutionPlanned", true, "formattedMessagePreview", ""),
            Map.of("eventConsumeLogWriteAllowed", true)),
        "formattedMessagePreview 缺失，不能规划 event_consume_log 写入");
    assertBlocked(
        service.buildPlan(
            readyLoggerExecutionPlan(), Map.of("eventConsumeLogWriteAllowed", false)),
        "event_consume_log write gate 尚未 ready");
  }

  @Test
  void sourceDoesNotExecuteDatabaseWriteBeforeRepositoryIntegration() throws IOException {
    String source =
        Files.readString(
            Path.of(
                "src/main/java/cn/yizuw/magic/backend/messaging/"
                    + "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService.java"));

    assertThat(source)
        .contains("eventConsumeLogWriteAllowed")
        .contains("databaseWritePlanned")
        .contains("databaseWriteExecuted")
        .doesNotContain("JdbcTemplate")
        .doesNotContain("Repository")
        .doesNotContain("Mapper")
        .doesNotContain(".insert")
        .doesNotContain(".save(")
        .doesNotContain(".update(")
        .doesNotContain("execute(")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  private Map<String, Object> readyLoggerExecutionPlan() {
    return Map.of(
        "loggerExecutionPlanned",
        true,
        "formattedMessagePreview",
        "would persist observation log");
  }

  private void assertBlocked(Map<String, Object> plan, String expectedReason) {
    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("databaseWriteRequested", true)
        .containsEntry("databaseWritePlanned", false)
        .containsEntry("formattedMessagePreview", "")
        .containsEntry(
            "nextAction", "keep_event_consume_log_write_blocked_until_logger_plan_and_gate_ready");
    assertThat(stringList(plan.get("blockedReasons"))).contains(expectedReason);
    assertNoSideEffects(plan);
  }

  private void assertNoSideEffects(Map<String, Object> plan) {
    assertThat(plan)
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

  private List<String> stringList(Object value) {
    if (value instanceof List<?> list) {
      return list.stream().map(String::valueOf).toList();
    }
    return List.of();
  }
}

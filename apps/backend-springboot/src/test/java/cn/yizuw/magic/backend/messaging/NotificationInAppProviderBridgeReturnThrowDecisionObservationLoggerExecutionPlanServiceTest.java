package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService
      service =
          new NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService();

  @Test
  void buildPlanAllowsOnlyGuardedLoggerExecutionDesignWhenInvocationDryRunIsReady() {
    Map<String, Object> plan =
        service.buildPlan(readyInvocationPlan(), Map.of("loggerExecutionAllowed", true));

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_logger_execution")
        .containsEntry("planStatus", "ready_for_guarded_observation_logger_execution")
        .containsEntry("loggerInvocationDryRunPlanProvided", true)
        .containsEntry("loggerInvocationPlanned", true)
        .containsEntry("formattedMessagePreviewAvailable", true)
        .containsEntry("loggerExecutionAllowed", true)
        .containsEntry("loggerExecutionRequiresExplicitGate", true)
        .containsEntry("allowedLoggerName", "NotificationRoutingRabbitListener")
        .containsEntry("allowedLogLevel", "INFO")
        .containsEntry("allowedMessageSource", "formattedMessagePreview")
        .containsEntry("formattedMessagePreview", "would log message")
        .containsEntry("loggerExecutionRequested", true)
        .containsEntry("loggerExecutionPlanned", true)
        .containsEntry(
            "nextAction", "ready_for_future_guarded_logger_invocation_source_integration_batch");
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertNoSideEffects(plan);
  }

  @Test
  void buildPlanBlocksUntilInvocationDryRunAndExplicitGateAreReady() {
    assertBlocked(
        service.buildPlan(Map.of(), Map.of("loggerExecutionAllowed", true)),
        "logger invocation dry-run plan 缺失，不能规划真实 Logger 灰度执行");
    assertBlocked(
        service.buildPlan(
            Map.of(
                "loggerInvocationPlanned",
                false,
                "formattedMessagePreview",
                "would log message"),
            Map.of("loggerExecutionAllowed", true)),
        "loggerInvocationPlanned=false，不能规划真实 Logger 灰度执行");
    assertBlocked(
        service.buildPlan(
            Map.of("loggerInvocationPlanned", true, "formattedMessagePreview", ""),
            Map.of("loggerExecutionAllowed", true)),
        "formattedMessagePreview 缺失，不能规划真实 Logger 灰度执行");
    assertBlocked(
        service.buildPlan(readyInvocationPlan(), Map.of("loggerExecutionAllowed", false)),
        "logger execution gate 尚未 ready");
  }

  @Test
  void sourceDefinesLoggerExecutionRedlinesWithoutOwningRealLogger() throws IOException {
    String source =
        Files.readString(
            Path.of(
                "src/main/java/cn/yizuw/magic/backend/messaging/"
                    + "NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService.java"));

    assertThat(source)
        .contains("loggerExecutionAllowed")
        .contains("loggerExecutionRequiresExplicitGate")
        .contains("allowedLogLevel")
        .contains("allowedMessageSource")
        .doesNotContain("org.slf4j.Logger")
        .doesNotContain("org.slf4j.LoggerFactory")
        .doesNotContain("LoggerFactory")
        .doesNotContain(".info(")
        .doesNotContain(".warn(")
        .doesNotContain(".error(")
        .doesNotContain("eventConsumeLog")
        .doesNotContain("insert")
        .doesNotContain("save(")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  private Map<String, Object> readyInvocationPlan() {
    return Map.of(
        "loggerInvocationPlanned",
        true,
        "formattedMessagePreview",
        "would log message");
  }

  private void assertBlocked(Map<String, Object> plan, String expectedReason) {
    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("loggerExecutionRequested", true)
        .containsEntry("loggerExecutionPlanned", false)
        .containsEntry("formattedMessagePreview", "")
        .containsEntry("nextAction", "keep_logger_execution_blocked_until_invocation_plan_and_gate_ready");
    assertThat(stringList(plan.get("blockedReasons"))).contains(expectedReason);
    assertNoSideEffects(plan);
  }

  private void assertNoSideEffects(Map<String, Object> plan) {
    assertThat(plan)
        .containsEntry("loggerInvocationExecuted", false)
        .containsEntry("logExecuted", false)
        .containsEntry("databaseWriteExecuted", false)
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

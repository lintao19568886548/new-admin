package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService
      service =
          new NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService();

  @Test
  void buildDryRunPlansLoggerInvocationWhenMessageAndGateAreReady() {
    Map<String, Object> plan =
        service.buildDryRun(
            readyMessagePlan(), Map.of("loggerInvocationAllowed", true));

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_logger_invocation")
        .containsEntry(
            "planStatus",
            "ready_for_bridge_return_throw_decision_observation_logger_invocation_dry_run")
        .containsEntry("messageDryRunPlanProvided", true)
        .containsEntry("messageFormattingPreviewGenerated", true)
        .containsEntry("formattedMessagePreviewAvailable", true)
        .containsEntry("loggerInvocationAllowed", true)
        .containsEntry("loggerNamePreview", "NotificationRoutingRabbitListener")
        .containsEntry("logLevelPreview", "INFO")
        .containsEntry("formattedMessagePreview", "would log message")
        .containsEntry("loggerInvocationRequested", true)
        .containsEntry("loggerInvocationPlanned", true)
        .containsEntry(
            "nextAction", "ready_for_future_listener_logger_invocation_integration_batch");
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertNoSideEffects(plan);
  }

  @Test
  void buildDryRunBlocksUntilMessageAndGateAreReady() {
    assertBlocked(
        service.buildDryRun(Map.of(), Map.of("loggerInvocationAllowed", true)),
        "message dry-run plan 缺失，不能规划 Logger 调用");
    assertBlocked(
        service.buildDryRun(
            Map.of(
                "messageFormattingPreviewGenerated",
                false,
                "formattedMessagePreview",
                "would log message"),
            Map.of("loggerInvocationAllowed", true)),
        "messageFormattingPreviewGenerated=false，不能规划 Logger 调用");
    assertBlocked(
        service.buildDryRun(
            Map.of(
                "messageFormattingPreviewGenerated",
                true,
                "formattedMessagePreview",
                ""),
            Map.of("loggerInvocationAllowed", true)),
        "formattedMessagePreview 缺失，不能规划 Logger 调用");
    assertBlocked(
        service.buildDryRun(readyMessagePlan(), Map.of("loggerInvocationAllowed", false)),
        "logger invocation gate 尚未 ready");
  }

  private Map<String, Object> readyMessagePlan() {
    return Map.of(
        "messageFormattingPreviewGenerated",
        true,
        "formattedMessagePreview",
        "would log message");
  }

  private void assertBlocked(Map<String, Object> plan, String expectedReason) {
    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("loggerInvocationRequested", true)
        .containsEntry("loggerInvocationPlanned", false)
        .containsEntry("formattedMessagePreview", "")
        .containsEntry("nextAction", "keep_logger_invocation_blocked_until_message_and_gate_ready");
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
        .containsEntry("rabbitNackExecuted", false);
  }

  private List<String> stringList(Object value) {
    if (value instanceof List<?> list) {
      return list.stream().map(String::valueOf).toList();
    }
    return List.of();
  }
}

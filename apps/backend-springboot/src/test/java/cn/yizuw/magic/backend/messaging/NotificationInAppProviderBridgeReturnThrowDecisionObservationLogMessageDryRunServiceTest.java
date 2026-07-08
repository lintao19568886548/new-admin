package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunServiceTest {

  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService
      service =
          new NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService();

  @Test
  void buildDryRunFormatsMessagePreviewWhenLogPlanIsReady() {
    Map<String, Object> plan = service.buildDryRun(readyLogPlan());

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_log_message_format")
        .containsEntry(
            "planStatus",
            "ready_for_bridge_return_throw_decision_observation_log_message_dry_run")
        .containsEntry("observationLogDryRunPlanProvided", true)
        .containsEntry("logPlanned", true)
        .containsEntry("logPayloadPreviewAvailable", true)
        .containsEntry("logMessageKeyAvailable", true)
        .containsEntry(
            "logMessageKey",
            "notification.in_app_provider.bridge_return_throw_decision_dry_run")
        .containsEntry("messageFormattingRequested", true)
        .containsEntry("messageFormattingPreviewGenerated", true)
        .containsEntry("nextAction", "ready_for_future_logger_invocation_integration_batch");
    assertThat(String.valueOf(plan.get("formattedMessagePreview")))
        .isEqualTo(
            "notification.in_app_provider.bridge_return_throw_decision_dry_run"
                + " eventId=evt_31 idempotencyKey=idem_31"
                + " classificationStatus=blocked futureListenerDecision=return_to_container");
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertNoSideEffects(plan);
  }

  @Test
  void buildDryRunBlocksUntilLogPlanPayloadAndMessageKeyAreReady() {
    assertBlocked(
        service.buildDryRun(Map.of()),
        "observation log dry-run plan 缺失，不能格式化日志消息");
    assertBlocked(
        service.buildDryRun(Map.of("logPlanned", false, "logPayloadPreview", Map.of())),
        "logPlanned=false，不能格式化日志消息");
    assertBlocked(
        service.buildDryRun(Map.of("logPlanned", true, "logPayloadPreview", Map.of())),
        "logPayloadPreview 缺失，不能格式化日志消息");
    assertBlocked(
        service.buildDryRun(
            Map.of(
                "logPlanned",
                true,
                "logMessageKey",
                "",
                "logPayloadPreview",
                Map.of("eventId", "evt_31"))),
        "logMessageKey 缺失，不能格式化日志消息");
  }

  private void assertBlocked(Map<String, Object> plan, String expectedReason) {
    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("messageFormattingRequested", true)
        .containsEntry("messageFormattingPreviewGenerated", false)
        .containsEntry("formattedMessagePreview", "")
        .containsEntry(
            "nextAction", "keep_observation_log_message_formatting_blocked_until_log_plan_ready");
    assertThat(stringList(plan.get("blockedReasons"))).contains(expectedReason);
    assertNoSideEffects(plan);
  }

  private Map<String, Object> readyLogPlan() {
    return Map.of(
        "logPlanned",
        true,
        "logMessageKey",
        "notification.in_app_provider.bridge_return_throw_decision_dry_run",
        "logPayloadPreview",
        Map.of(
            "eventId",
            "evt_31",
            "idempotencyKey",
            "idem_31",
            "bridgeResult",
            Map.of("classificationStatus", "blocked"),
            "policyDecisionPlan",
            Map.of("futureListenerDecision", "return_to_container")));
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

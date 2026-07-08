package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** adapter 到 validator classify 的独立 dry-run 桥接测试；不接 listener。 */
class NotificationInAppProviderConsumerResultClassificationBridgeServiceTest {

  private final NotificationInAppProviderConsumerResultClassificationBridgeService service =
      new NotificationInAppProviderConsumerResultClassificationBridgeService(
          new NotificationInAppProviderConsumerResultAdapterService(),
          new NotificationInAppProviderConsumerResultValidationPlanService());

  @Test
  void classifyDryRunReturnsReadyClassificationForAdapterResultWithInvocationPlan() {
    Map<String, Object> plan = service.classifyDryRun(success(readySendPlan()));

    assertThat(plan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider.consumer_result_classification_bridge")
        .containsEntry("planStatus", "classification_dry_run_completed")
        .containsEntry("sourceResultProvided", true)
        .containsEntry("adapterBean", "notificationInAppProviderConsumerResultAdapterService")
        .containsEntry("adapterMethod", "adapt")
        .containsEntry("validatorBean", "notificationInAppProviderConsumerResultValidationPlanService")
        .containsEntry("validatorMethod", "classify")
        .containsEntry("adapterExecuted", true)
        .containsEntry("consumerResultConstructed", true)
        .containsEntry("consumerResultForwardedToValidator", true)
        .containsEntry("classificationRequested", true)
        .containsEntry("classificationExecuted", true)
        .containsEntry("classificationCode", "ready_for_result_adapter_validation")
        .containsEntry("classificationStatus", "ready")
        .containsEntry("classificationPassed", true)
        .containsEntry("futureAckNackScenario", "future_validation_ready")
        .containsEntry(
            "futureReturnThrowDecision",
            "return_deferred_until_manual_execution_result_is_verified")
        .containsEntry(
            "futureAckDecision", "defer_ack_until_manual_execution_result_is_verified")
        .containsEntry(
            "futureNackDecision", "not_applicable_until_real_adapter_policy_batch")
        .containsEntry("nextAction", "ready_for_future_listener_validator_integration_batch");
    assertNoSideEffects(plan);
    assertThat(classification(plan))
        .containsEntry("classificationCode", "ready_for_result_adapter_validation")
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("manualExecutionAllowed", false);
  }

  @Test
  void classifyDryRunBlocksBeforeValidatorWhenAdapterCannotBuildConsumerResult() {
    Map<String, Object> plan = service.classifyDryRun(null);

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("sourceResultProvided", false)
        .containsEntry("consumerResultConstructed", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("classificationRequested", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("classificationCode", "adapter_blocked")
        .containsEntry("classificationStatus", "blocked")
        .containsEntry("classificationPassed", false)
        .containsEntry("futureAckNackScenario", "adapter_blocked_before_validation")
        .containsEntry(
            "futureReturnThrowDecision",
            "throw_before_classify_until_real_adapter_policy_batch")
        .containsEntry("futureAckDecision", "no_ack_until_real_adapter_policy_batch")
        .containsEntry(
            "futureNackDecision", "throw_for_retry_or_dlq_until_real_policy_batch")
        .containsEntry("nextAction", "fix_consumer_result_adapter_before_validator_classification");
    assertThat(classification(plan)).isEmpty();
    assertNoSideEffects(plan);
  }

  @Test
  void classifyDryRunMapsValidatorBlockedClassificationToThrowBoundary() {
    Map<String, Object> plan = service.classifyDryRun(success(blockedStatusSendPlan()));

    assertThat(plan)
        .containsEntry("planStatus", "classification_dry_run_completed")
        .containsEntry("consumerResultConstructed", true)
        .containsEntry("classificationRequested", true)
        .containsEntry("classificationExecuted", true)
        .containsEntry("classificationCode", "in_app_execution_plan_blocked")
        .containsEntry("classificationStatus", "blocked")
        .containsEntry("classificationPassed", false)
        .containsEntry("futureAckNackScenario", "future_validation_blocked")
        .containsEntry(
            "futureReturnThrowDecision", "throw_for_retry_or_dlq_until_real_policy_batch")
        .containsEntry("futureAckDecision", "no_ack_until_real_adapter_policy_batch")
        .containsEntry(
            "futureNackDecision", "throw_for_retry_or_dlq_until_real_policy_batch");
    assertThat(classification(plan))
        .containsEntry("classificationCode", "in_app_execution_plan_blocked")
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("manualExecutionAllowed", false);
    assertNoSideEffects(plan);
  }

  @Test
  void classifyDryRunKeepsListenerAndRabbitSideEffectsDisabledForEveryOutcome() {
    assertNoSideEffects(service.classifyDryRun(success(readySendPlan())));
    assertNoSideEffects(service.classifyDryRun(success(missingInvocationPlanSendPlan())));
    assertNoSideEffects(service.classifyDryRun(null));
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> classification(Map<String, Object> plan) {
    return (Map<String, Object>) plan.get("validatorClassification");
  }

  private void assertNoSideEffects(Map<String, Object> plan) {
    assertThat(plan)
        .containsEntry("listenerInvoked", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushExecuted", false);
  }

  private OrganizationProvisioningCompletedNotificationConsumeResult success(
      Map<String, Object> sendPlan) {
    return new OrganizationProvisioningCompletedNotificationConsumeResult(
        true,
        false,
        "evt_31",
        "idem_31",
        31,
        sendPlan,
        true,
        "notification_send_plan_generated",
        "success",
        "org001",
        "tenant_org001");
  }

  private Map<String, Object> readySendPlan() {
    return sendPlan(
        Map.of(
            "planStatus",
            "ready_for_write_plan",
            "listenerAutoExecutionGatePlan",
            Map.of("invocationPlan", Map.of("planStatus", "ready_for_invocation_dry_run"))));
  }

  private Map<String, Object> blockedStatusSendPlan() {
    return sendPlan(
        Map.of(
            "planStatus",
            "blocked",
            "listenerAutoExecutionGatePlan",
            Map.of("invocationPlan", Map.of("planStatus", "blocked"))));
  }

  private Map<String, Object> missingInvocationPlanSendPlan() {
    return sendPlan(
        Map.of(
            "planStatus",
            "ready_for_write_plan",
            "listenerAutoExecutionGatePlan",
            Map.of()));
  }

  private Map<String, Object> sendPlan(Map<String, Object> inAppExecutionPlan) {
    Map<String, Object> providerPlan = new LinkedHashMap<>();
    providerPlan.put("inAppExecutionPlan", inAppExecutionPlan);
    Map<String, Object> sendPlan = new LinkedHashMap<>();
    sendPlan.put("providerPlan", providerPlan);
    return sendPlan;
  }
}

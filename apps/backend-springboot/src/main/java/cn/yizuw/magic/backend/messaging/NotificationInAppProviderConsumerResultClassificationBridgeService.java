package cn.yizuw.magic.backend.messaging;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 专用 consumer result adapter 到 validator classify 的独立 dry-run 桥接；不接 listener。 */
@Service
public class NotificationInAppProviderConsumerResultClassificationBridgeService {

  private static final String ACK_NO_ACK_UNTIL_REAL_ADAPTER_POLICY_BATCH =
      "no_ack_until_real_adapter_policy_batch";
  private static final String ACK_DEFER_UNTIL_MANUAL_EXECUTION_VERIFIED =
      "defer_ack_until_manual_execution_result_is_verified";
  private static final String NACK_THROW_FOR_RETRY_OR_DLQ_UNTIL_REAL_POLICY_BATCH =
      "throw_for_retry_or_dlq_until_real_policy_batch";
  private static final String NACK_NOT_APPLICABLE_UNTIL_REAL_ADAPTER_POLICY_BATCH =
      "not_applicable_until_real_adapter_policy_batch";
  private static final String SCENARIO_ADAPTER_BLOCKED_BEFORE_VALIDATION =
      "adapter_blocked_before_validation";
  private static final String SCENARIO_FUTURE_VALIDATION_BLOCKED =
      "future_validation_blocked";
  private static final String SCENARIO_FUTURE_VALIDATION_READY =
      "future_validation_ready";
  private static final String RETURN_THROW_ADAPTER_BLOCKED =
      "throw_before_classify_until_real_adapter_policy_batch";
  private static final String RETURN_THROW_VALIDATION_BLOCKED =
      "throw_for_retry_or_dlq_until_real_policy_batch";
  private static final String RETURN_THROW_VALIDATION_READY =
      "return_deferred_until_manual_execution_result_is_verified";

  private final NotificationInAppProviderConsumerResultAdapterService adapterService;
  private final NotificationInAppProviderConsumerResultValidationPlanService
      validationPlanService;

  public NotificationInAppProviderConsumerResultClassificationBridgeService(
      NotificationInAppProviderConsumerResultAdapterService adapterService,
      NotificationInAppProviderConsumerResultValidationPlanService validationPlanService) {
    this.adapterService = adapterService;
    this.validationPlanService = validationPlanService;
  }

  public Map<String, Object> classifyDryRun(
      OrganizationProvisioningCompletedNotificationConsumeResult sourceResult) {
    Map<String, Object> adapterPlan = adapterService.adapt(sourceResult);
    boolean adapterReady = booleanValue(adapterPlan.get("consumerResultConstructed"));
    Map<String, Object> classification =
        adapterReady ? validationPlanService.classify(consumerResult(adapterPlan)) : Map.of();
    boolean classificationPassed = booleanValue(classification.get("classificationPassed"));

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.consumer_result_classification_bridge");
    plan.put(
        "planStatus", adapterReady ? "classification_dry_run_completed" : "blocked");
    plan.put("sourceResultType", "OrganizationProvisioningCompletedNotificationConsumeResult");
    plan.put("sourceResultProvided", adapterPlan.get("sourceResultProvided"));
    plan.put("adapterBean", "notificationInAppProviderConsumerResultAdapterService");
    plan.put("adapterMethod", "adapt");
    plan.put("validatorBean", "notificationInAppProviderConsumerResultValidationPlanService");
    plan.put("validatorMethod", "classify");
    plan.put("adapterPlan", adapterPlan);
    plan.put("validatorClassification", classification);
    plan.put("adapterExecuted", true);
    plan.put("consumerResultConstructed", adapterReady);
    plan.put("consumerResultForwardedToValidator", adapterReady);
    plan.put("classificationRequested", adapterReady);
    plan.put("classificationExecuted", adapterReady);
    plan.put(
        "classificationCode",
        adapterReady ? classification.get("classificationCode") : "adapter_blocked");
    plan.put(
        "classificationStatus",
        adapterReady ? classification.get("classificationStatus") : "blocked");
    plan.put("classificationPassed", classificationPassed);
    plan.put("futureAckNackScenario", futureAckNackScenario(adapterReady, classificationPassed));
    plan.put(
        "futureReturnThrowDecision",
        futureReturnThrowDecision(adapterReady, classificationPassed));
    plan.put("futureAckDecision", futureAckDecision(adapterReady, classificationPassed));
    plan.put("futureNackDecision", futureNackDecision(adapterReady, classificationPassed));
    plan.put("listenerInvoked", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("manualExecutionExecuted", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("websocketExecuted", false);
    plan.put("pushExecuted", false);
    plan.put(
        "nextAction",
        adapterReady
            ? "ready_for_future_listener_validator_integration_batch"
            : "fix_consumer_result_adapter_before_validator_classification");
    return plan;
  }

  private Map<String, Object> consumerResult(Map<String, Object> adapterPlan) {
    Object value = adapterPlan.get("consumerResult");
    if (value instanceof Map<?, ?> map) {
      Map<String, Object> consumerResult = new LinkedHashMap<>();
      for (Map.Entry<?, ?> entry : map.entrySet()) {
        consumerResult.put(String.valueOf(entry.getKey()), entry.getValue());
      }
      return consumerResult;
    }
    return Map.of();
  }

  private String futureAckNackScenario(boolean adapterReady, boolean classificationPassed) {
    if (!adapterReady) {
      return SCENARIO_ADAPTER_BLOCKED_BEFORE_VALIDATION;
    }
    return classificationPassed ? SCENARIO_FUTURE_VALIDATION_READY : SCENARIO_FUTURE_VALIDATION_BLOCKED;
  }

  private String futureReturnThrowDecision(boolean adapterReady, boolean classificationPassed) {
    if (!adapterReady) {
      return RETURN_THROW_ADAPTER_BLOCKED;
    }
    return classificationPassed ? RETURN_THROW_VALIDATION_READY : RETURN_THROW_VALIDATION_BLOCKED;
  }

  private String futureAckDecision(boolean adapterReady, boolean classificationPassed) {
    if (adapterReady && classificationPassed) {
      return ACK_DEFER_UNTIL_MANUAL_EXECUTION_VERIFIED;
    }
    return ACK_NO_ACK_UNTIL_REAL_ADAPTER_POLICY_BATCH;
  }

  private String futureNackDecision(boolean adapterReady, boolean classificationPassed) {
    if (adapterReady && classificationPassed) {
      return NACK_NOT_APPLICABLE_UNTIL_REAL_ADAPTER_POLICY_BATCH;
    }
    return NACK_THROW_FOR_RETRY_OR_DLQ_UNTIL_REAL_POLICY_BATCH;
  }

  private boolean booleanValue(Object value) {
    return Boolean.TRUE.equals(value);
  }
}

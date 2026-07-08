package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** consumer result 校验预案测试；第 181 批增加纯内存分类样例。 */
class NotificationInAppProviderConsumerResultValidationPlanServiceTest {

  private final NotificationInAppProviderConsumerResultValidationPlanService service =
      new NotificationInAppProviderConsumerResultValidationPlanService();

  @Test
  void buildPlanReturnsReusableDryRunValidationShape() {
    Map<String, Object> plan = service.buildPlan();

    assertThat(plan)
        .containsEntry(
            "planType", "notification.consumer.delegation.in_app_provider_result_validation")
        .containsEntry("planStatus", "classification_dry_run")
        .containsEntry(
            "validatorBean", "notificationInAppProviderConsumerResultValidationPlanService")
        .containsEntry("consumerResultRequired", true)
        .containsEntry("consumerResultProvided", false)
        .containsEntry("consumerResultInspected", false)
        .containsEntry("validationExecuted", false)
        .containsEntry(
            "executionBoundary",
            "第 180 批只提炼 consumer result 校验预案 service，不读取真实 result")
        .containsEntry(
            "nextAction", "classify_real_consumer_result_before_result_adapter_executes");
    assertThat((List<Object>) plan.get("sourceResultPath"))
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan");
    assertThat((List<Object>) plan.get("blockedStatusPath"))
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan", "planStatus");
    assertThat((List<Object>) plan.get("invocationPlanPath"))
        .containsExactly(
            "sendPlan",
            "providerPlan",
            "inAppExecutionPlan",
            "listenerAutoExecutionGatePlan",
            "invocationPlan");
    assertThat((List<Object>) plan.get("requiredNestedPaths"))
        .contains(
            List.of("sendPlan"),
            List.of("sendPlan", "providerPlan", "inAppExecutionPlan"),
            List.of(
                "sendPlan",
                "providerPlan",
                "inAppExecutionPlan",
                "listenerAutoExecutionGatePlan",
                "invocationPlan"));
    assertThat((List<Object>) plan.get("errorClassifications"))
        .anySatisfy(
            classification ->
                assertThat((Map<String, Object>) classification)
                    .containsEntry("code", "missing_send_plan")
                    .containsEntry("adapterInvocationAllowed", false)
                    .containsEntry("manualExecutionAllowed", false))
        .anySatisfy(
            classification ->
                assertThat((Map<String, Object>) classification)
                    .containsEntry("code", "missing_provider_plan"))
        .anySatisfy(
            classification ->
                assertThat((Map<String, Object>) classification)
                    .containsEntry("code", "missing_in_app_execution_plan"))
        .anySatisfy(
            classification ->
                assertThat((Map<String, Object>) classification)
                    .containsEntry("code", "in_app_execution_plan_blocked"))
        .anySatisfy(
            classification ->
                assertThat((Map<String, Object>) classification)
                    .containsEntry(
                        "code", "missing_listener_auto_execution_invocation_plan"));
  }

  @Test
  void sourceResultPathCanBeReusedByAdapterPlanService() {
    assertThat(service.sourceResultPath())
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan");
  }

  @Test
  void buildPlanKeepsClassificationCodesStableAfterConstantExtraction() {
    Map<String, Object> plan = service.buildPlan();

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> errorClassifications =
        (List<Map<String, Object>>) plan.get("errorClassifications");
    assertThat(errorClassifications)
        .extracting(classification -> classification.get("code"))
        .containsExactly(
            "missing_send_plan",
            "missing_provider_plan",
            "missing_in_app_execution_plan",
            "in_app_execution_plan_blocked",
            "missing_listener_auto_execution_invocation_plan");
    assertThat(errorClassifications)
        .allSatisfy(
            classification ->
                assertThat(classification)
                    .containsEntry("adapterInvocationAllowed", false)
                    .containsEntry("manualExecutionAllowed", false)
                    .containsEntry(
                        "rabbitAckDecision", "throw_to_retry_or_dlq_until_real_policy_batch"));
  }

  @Test
  void classifyKeepsClassificationResultStringsStableAfterConstantExtraction() {
    List<Map<String, Object>> results =
        List.of(
            service.classify(Map.of()),
            service.classify(Map.of("sendPlan", Map.of("providerPlan", Map.of()))),
            service.classify(
                Map.of(
                    "sendPlan",
                    Map.of("providerPlan", Map.of("providerCallExecuted", false)))),
            service.classify(
                consumerResult(
                    Map.of(
                        "planStatus",
                        "blocked",
                        "listenerAutoExecutionGatePlan",
                        Map.of()))),
            service.classify(
                consumerResult(
                    Map.of(
                        "planStatus",
                        "ready_for_write_plan",
                        "listenerAutoExecutionGatePlan",
                        Map.of()))),
            service.classify(
                consumerResult(
                    Map.of(
                        "planStatus",
                        "ready_for_write_plan",
                        "listenerAutoExecutionGatePlan",
                        Map.of(
                            "invocationPlan",
                            Map.of("planStatus", "ready_for_invocation_dry_run"))))));

    assertThat(results)
        .extracting(result -> result.get("classificationCode"))
        .containsExactly(
            "missing_send_plan",
            "missing_provider_plan",
            "missing_in_app_execution_plan",
            "in_app_execution_plan_blocked",
            "missing_listener_auto_execution_invocation_plan",
            "ready_for_result_adapter_validation");
    assertThat(results)
        .extracting(result -> result.get("classificationStatus"))
        .containsExactly("blocked", "blocked", "blocked", "blocked", "blocked", "ready");
    assertThat(results)
        .allSatisfy(
            result ->
                assertThat(result)
                    .containsEntry("adapterInvocationAllowed", false)
                    .containsEntry("manualExecutionAllowed", false)
                    .containsEntry("consumerResultInspected", true)
                    .containsEntry("validationExecuted", true));
  }

  @Test
  void classifyBlocksWhenSendPlanIsMissing() {
    Map<String, Object> result = service.classify(Map.of());

    assertThat(result)
        .containsEntry("classificationCode", "missing_send_plan")
        .containsEntry("classificationStatus", "blocked")
        .containsEntry("classificationPassed", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("consumerResultInspected", true)
        .containsEntry("validationExecuted", true);
    assertThat((List<Object>) result.get("path")).containsExactly("sendPlan");
  }

  @Test
  void classifyBlocksWhenProviderPlanIsMissing() {
    Map<String, Object> consumerResult =
        Map.of("sendPlan", Map.of("providerPlan", Map.of()));

    Map<String, Object> result = service.classify(consumerResult);

    assertThat(result)
        .containsEntry("classificationCode", "missing_provider_plan")
        .containsEntry("classificationPassed", false);
  }

  @Test
  void classifyBlocksWhenInAppExecutionPlanIsMissing() {
    Map<String, Object> consumerResult =
        Map.of("sendPlan", Map.of("providerPlan", Map.of("providerCallExecuted", false)));

    Map<String, Object> result = service.classify(consumerResult);

    assertThat(result)
        .containsEntry("classificationCode", "missing_in_app_execution_plan")
        .containsEntry("classificationPassed", false);
    assertThat((List<Object>) result.get("path"))
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan");
  }

  @Test
  void classifyBlocksWhenInAppExecutionPlanStatusIsNotReady() {
    Map<String, Object> result =
        service.classify(
            consumerResult(
                Map.of(
                    "planStatus",
                    "blocked",
                    "listenerAutoExecutionGatePlan",
                    Map.of())));

    assertThat(result)
        .containsEntry("classificationCode", "in_app_execution_plan_blocked")
        .containsEntry("classificationStatus", "blocked")
        .containsEntry("classificationPassed", false);
    assertThat((List<Object>) result.get("path"))
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan", "planStatus");
  }

  @Test
  void classifyBlocksWhenInvocationPlanIsMissing() {
    Map<String, Object> result =
        service.classify(
            consumerResult(
                Map.of(
                    "planStatus",
                    "ready_for_write_plan",
                    "listenerAutoExecutionGatePlan",
                    Map.of())));

    assertThat(result)
        .containsEntry("classificationCode", "missing_listener_auto_execution_invocation_plan")
        .containsEntry("classificationPassed", false);
  }

  @Test
  void classifyReturnsReadyForCompleteResultShapeButStillDoesNotAllowExecution() {
    Map<String, Object> result =
        service.classify(
            consumerResult(
                Map.of(
                    "planStatus",
                    "ready_for_write_plan",
                    "listenerAutoExecutionGatePlan",
                    Map.of(
                        "invocationPlan",
                        Map.of("planStatus", "ready_for_invocation_dry_run")))));

    assertThat(result)
        .containsEntry("classificationCode", "ready_for_result_adapter_validation")
        .containsEntry("classificationStatus", "ready")
        .containsEntry("classificationPassed", true)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("consumerResultInspected", true)
        .containsEntry("validationExecuted", true)
        .containsEntry("rabbitAckDecision", "keep_current_listener_policy");
    assertThat((List<Object>) result.get("sourceResultPath"))
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan");
  }

  private Map<String, Object> consumerResult(Map<String, Object> inAppExecutionPlan) {
    return Map.of(
        "sendPlan",
        Map.of("providerPlan", Map.of("inAppExecutionPlan", inAppExecutionPlan)));
  }
}

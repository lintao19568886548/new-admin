package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** in_app provider 自动执行 adapter 安全门测试；第 178 批只生成 dry-run。 */
class NotificationInAppProviderAutoExecutionAdapterPlanServiceTest {

  private final AppProperties appProperties = new AppProperties();
  private final NotificationInAppProviderConsumerResultValidationPlanService validationPlanService =
      new NotificationInAppProviderConsumerResultValidationPlanService();
  private final NotificationInAppProviderAutoExecutionAdapterPlanService service =
      new NotificationInAppProviderAutoExecutionAdapterPlanService(
          appProperties,
          validationPlanService,
          new NotificationInAppProviderListenerNoopPlanService(
              appProperties, validationPlanService));

  @Test
  void buildPlanBlocksByDefaultEvenWhenDedicatedConsumerDelegationIsAllowed() {
    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), organizationValidationPlan(), true, List.of());

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("resultAdapterEnabled", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("adapterInvocationExecuted", false)
        .containsEntry("resultAdapterInvocationExecuted", false)
        .containsEntry("manualExecutionExecuted", false);
    assertThat((List<Object>) plan.get("readinessFailedChecks"))
        .containsExactly("result_adapter_gate_enabled");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "result adapter 安全门仍有失败项: [result_adapter_gate_enabled]");
    assertReadinessMatrix(plan, "result_adapter_gate_enabled", false);
    assertReadinessMatrix(plan, "adapter_side_effect_free", true);
    assertThat((Map<String, Object>) plan.get("listenerNoopIntegrationPlan"))
        .containsEntry("planStatus", "blocked")
        .containsEntry("listenerNoopEnabled", false)
        .containsEntry("noopBranchExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("ackDecision", "keep_current_listener_policy")
        .containsEntry("nackDecision", "keep_current_listener_throw_policy")
        .containsEntry("ackNackDecisionExecuted", false)
        .containsEntry("ackNackPolicyChanged", false);
    assertListenerNoopAckNackDecision(plan, "adapter_plan_blocked", true);
    assertListenerNoopAckNackDecision(plan, "future_validation_ready", false);
  }

  @Test
  void buildPlanReturnsReadyDryRunOnlyWhenResultAdapterGateIsEnabled() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterEnabled(true);

    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), organizationValidationPlan(), true, List.of());

    assertThat(plan)
        .containsEntry("planType", "notification.consumer.delegation.in_app_provider_adapter")
        .containsEntry("planStatus", "ready_for_result_adapter_dry_run")
        .containsEntry(
            "route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED)
        .containsEntry("routeSupported", true)
        .containsEntry(
            "requestType", "OrganizationProvisioningCompletedNotificationConsumeRequest")
        .containsEntry("requestTypeMatched", true)
        .containsEntry("delegationAllowed", true)
        .containsEntry("resultAdapterEnabled", true)
        .containsEntry("providerCallEnabled", false)
        .containsEntry("providerCallBlocked", false)
        .containsEntry(
            "adapterBean", "organizationProvisioningCompletedInAppProviderAutoExecutionAdapter")
        .containsEntry(
            "sourceConsumerBean", "organizationProvisioningCompletedNotificationConsumerService")
        .containsEntry("sourceConsumerMethod", "consume")
        .containsEntry(
            "sourceResultType", "OrganizationProvisioningCompletedNotificationConsumeResult")
        .containsEntry(
            "manualExecutionBean",
            "organizationProvisioningCompletedInAppProviderManualExecutionService")
        .containsEntry("manualExecutionMethod", "execute")
        .containsEntry(
            "manualExecutionArgumentSource",
            "consumerResult.sendPlan.providerPlan.inAppExecutionPlan")
        .containsEntry("adapterInvocationAllowed", true)
        .containsEntry("adapterInvocationRequested", false)
        .containsEntry("adapterInvocationExecuted", false)
        .containsEntry("resultAdapterInvocationRequested", false)
        .containsEntry("resultAdapterInvocationExecuted", false)
        .containsEntry("consumerResultInspected", false)
        .containsEntry("manualExecutionRequested", false)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushExecuted", false)
        .containsEntry("ackStrategy", "keep_current_delegation_ack_until_real_adapter_batch")
        .containsEntry("nackStrategy", "keep_current_delegation_throw_on_non_ackable_result")
        .containsEntry(
            "nextAction",
            "ready_for_future_listener_result_adapter_batch_but_current_plan_does_not_execute");
    assertThat((List<Object>) plan.get("blockedReasons")).isEmpty();
    assertThat((List<Object>) plan.get("readinessFailedChecks")).isEmpty();
    assertReadinessMatrix(plan, "result_adapter_gate_enabled", true);
    assertThat((List<Object>) plan.get("sourceResultPath"))
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan");
    assertThat((List<Object>) plan.get("executionOrder"))
        .contains(
            "delegate_to_dedicated_consumer",
            "inspect_ackable_consumer_result",
            "call_manual_execution_service");
    assertThat((List<Object>) plan.get("expectedInAppExecutionPlanFields"))
        .contains("executorPreflightPlan", "writePreview", "listenerAutoExecutionGatePlan");
    assertConsumerResultValidationPlan(plan);
    assertThat((Map<String, Object>) plan.get("listenerNoopIntegrationPlan"))
        .containsEntry("planStatus", "blocked")
        .containsEntry("adapterPlanReady", true)
        .containsEntry("listenerNoopEnabled", false)
        .containsEntry("noopBranchAllowed", false)
        .containsEntry("noopBranchExecuted", false);
  }

  @Test
  void buildPlanAllowsOnlyListenerNoopDryRunWhenBothAdapterAndNoopGatesAreEnabled() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);

    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), organizationValidationPlan(), true, List.of());

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_result_adapter_dry_run")
        .containsEntry("adapterInvocationAllowed", true)
        .containsEntry("adapterInvocationExecuted", false);
    assertThat((Map<String, Object>) plan.get("listenerNoopIntegrationPlan"))
        .containsEntry("planStatus", "ready_for_listener_noop_dry_run")
        .containsEntry("listenerNoopEnabled", true)
        .containsEntry("adapterPlanReady", true)
        .containsEntry("noopBranchAllowed", true)
        .containsEntry("noopBranchRequested", false)
        .containsEntry("noopBranchExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("ackNackDecisionExecuted", false)
        .containsEntry("ackNackPolicyChanged", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
    assertListenerNoopAckNackDecision(plan, "noop_branch_allowed", true);
    assertListenerNoopAckNackDecision(plan, "future_validation_blocked", false);
    assertListenerNoopValidatorContract(plan, "ready_for_validator_contract_dry_run");
  }

  @Test
  void buildPlanExposesReadOnlyNestedNoopValidatorContractWhenAllGatesAreEnabled() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);

    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), organizationValidationPlan(), true, List.of());

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_result_adapter_dry_run")
        .containsEntry("adapterInvocationAllowed", true)
        .containsEntry("adapterInvocationExecuted", false)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
    @SuppressWarnings("unchecked")
    Map<String, Object> listenerPlan =
        (Map<String, Object>) plan.get("listenerNoopIntegrationPlan");
    assertThat(listenerPlan)
        .containsEntry("planStatus", "ready_for_listener_noop_dry_run")
        .containsEntry("noopBranchAllowed", true)
        .containsEntry("noopBranchExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("ackNackDecisionExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) listenerPlan.get("validatorContractPlan");
    assertThat(contractPlan)
        .containsEntry("planStatus", "ready_for_validator_contract_dry_run")
        .containsEntry("argumentSourceAvailable", false)
        .containsEntry("ackNackAlignmentExecuted", false)
        .containsEntry("contractCheckExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("manualExecutionAllowed", false);
    assertThat((List<Object>) contractPlan.get("inputSampleMatrix"))
        .hasSize(6)
        .anySatisfy(
            sample ->
                assertThat((Map<String, Object>) sample)
                    .containsEntry("sampleName", "missing_send_plan_sample")
                    .containsEntry("samplePayloadProvided", false)
                    .containsEntry("classificationExecuted", false))
        .anySatisfy(
            sample ->
                assertThat((Map<String, Object>) sample)
                    .containsEntry(
                        "sampleName", "ready_for_result_adapter_validation_sample")
                    .containsEntry(
                        "expectedClassification", "ready_for_result_adapter_validation")
                    .containsEntry("classificationExecuted", false));
    assertThat((List<Object>) contractPlan.get("ackNackAlignmentMatrix"))
        .hasSize(6)
        .anySatisfy(
            alignment ->
                assertThat((Map<String, Object>) alignment)
                    .containsEntry("classification", "missing_send_plan")
                    .containsEntry("ackNackScenario", "future_validation_blocked")
                    .containsEntry("alignmentExecuted", false)
                    .containsEntry("rabbitNackExecuted", false))
        .anySatisfy(
            alignment ->
                assertThat((Map<String, Object>) alignment)
                    .containsEntry(
                        "classification", "ready_for_result_adapter_validation")
                    .containsEntry("ackNackScenario", "future_validation_ready")
                    .containsEntry("alignmentExecuted", false)
                    .containsEntry("rabbitAckExecuted", false));
    assertAckNackAlignment(contractPlan, "missing_provider_plan", "future_validation_blocked");
    assertAckNackAlignment(
        contractPlan, "missing_in_app_execution_plan", "future_validation_blocked");
    assertAckNackAlignment(
        contractPlan, "in_app_execution_plan_blocked", "future_validation_blocked");
    assertAckNackAlignment(
        contractPlan,
        "missing_listener_auto_execution_invocation_plan",
        "future_validation_blocked");
  }

  @Test
  void buildPlanDocumentsListenerNoopContractWithoutManualExecutionOrAckNack() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);

    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), organizationValidationPlan(), true, List.of());

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_result_adapter_dry_run")
        .containsEntry("adapterInvocationAllowed", true)
        .containsEntry("adapterInvocationRequested", false)
        .containsEntry("adapterInvocationExecuted", false)
        .containsEntry("resultAdapterInvocationRequested", false)
        .containsEntry("resultAdapterInvocationExecuted", false)
        .containsEntry("consumerResultInspected", false)
        .containsEntry("manualExecutionRequested", false)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushExecuted", false)
        .containsEntry("ackStrategy", "keep_current_delegation_ack_until_real_adapter_batch")
        .containsEntry("nackStrategy", "keep_current_delegation_throw_on_non_ackable_result");
    @SuppressWarnings("unchecked")
    Map<String, Object> listenerPlan =
        (Map<String, Object>) plan.get("listenerNoopIntegrationPlan");
    assertThat(listenerPlan)
        .containsEntry("planStatus", "ready_for_listener_noop_dry_run")
        .containsEntry("noopBranchAllowed", true)
        .containsEntry("noopBranchRequested", false)
        .containsEntry("noopBranchExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("consumerResultInspected", false)
        .containsEntry("manualExecutionRequested", false)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("ackDecision", "keep_current_listener_policy")
        .containsEntry("nackDecision", "keep_current_listener_throw_policy")
        .containsEntry("ackNackDecisionExecuted", false)
        .containsEntry("ackNackPolicyChanged", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushExecuted", false);
    assertThat((List<Object>) listenerPlan.get("blockedReasons")).isEmpty();
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) listenerPlan.get("validatorContractPlan");
    assertThat(contractPlan)
        .containsEntry("planStatus", "ready_for_validator_contract_dry_run")
        .containsEntry("validatorMethod", "classify")
        .containsEntry("argumentSourceAvailable", false)
        .containsEntry("contractCheckRequested", false)
        .containsEntry("contractCheckExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("consumerResultInspected", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
    assertListenerNoopAckNackDecision(plan, "noop_branch_allowed", true);
    assertListenerNoopAckNackDecision(plan, "future_validation_ready", false);
    assertAckNackAlignment(
        contractPlan, "ready_for_result_adapter_validation", "future_validation_ready");
  }

  @Test
  void buildPlanExposesNestedNoopValidatorInputAdapterAndAckNackContractsTogether() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);

    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), organizationValidationPlan(), true, List.of());

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_result_adapter_dry_run")
        .containsEntry("adapterInvocationExecuted", false)
        .containsEntry("resultAdapterInvocationExecuted", false)
        .containsEntry("manualExecutionExecuted", false);
    @SuppressWarnings("unchecked")
    Map<String, Object> listenerPlan =
        (Map<String, Object>) plan.get("listenerNoopIntegrationPlan");
    assertThat(listenerPlan)
        .containsEntry("planStatus", "ready_for_listener_noop_dry_run")
        .containsEntry("noopBranchExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("manualExecutionExecuted", false);
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) listenerPlan.get("validatorContractPlan");
    assertThat(contractPlan)
        .containsEntry("planStatus", "ready_for_validator_contract_dry_run")
        .containsEntry("contractCheckExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("manualExecutionAllowed", false);
    @SuppressWarnings("unchecked")
    Map<String, Object> inputAdapterPlan =
        (Map<String, Object>) contractPlan.get("inputAdapterPlan");
    assertThat(inputAdapterPlan)
        .containsEntry("planStatus", "ready_for_validator_input_adapter_dry_run")
        .containsEntry("adapterExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("manualExecutionAllowed", false);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> alignmentMatrix =
        (List<Map<String, Object>>) contractPlan.get("ackNackAlignmentMatrix");
    assertThat(alignmentMatrix)
        .hasSize(6)
        .allSatisfy(
            alignment ->
                assertThat(alignment)
                    .containsEntry("alignmentExecuted", false)
                    .containsEntry("classificationExecuted", false)
                    .containsEntry("rabbitAckExecuted", false)
                    .containsEntry("rabbitNackExecuted", false));
    assertThat(plan)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushExecuted", false);
  }

  @Test
  void buildPlanBlocksWhenDelegationIsNotAllowed() {
    Map<String, Object> plan =
        service.buildPlan(
            organizationRoutingPlan(),
            organizationValidationPlan(),
            false,
            List.of("delegation_gate_enabled"));

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("delegationAllowed", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("adapterInvocationExecuted", false)
        .containsEntry(
            "nextAction",
            "fix_in_app_provider_adapter_plan_blockers_before_listener_result_integration");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "专用 consumer 委托尚未允许，不能规划后置 in_app provider adapter",
            "专用 consumer 委托安全门仍有失败项: [delegation_gate_enabled]",
            "result adapter 安全门仍有失败项: "
                + "[delegation_allowed, delegation_failed_checks_empty, result_adapter_gate_enabled]");
  }

  @Test
  void buildPlanBlocksWhenProviderCallFlagsArePresent() {
    Map<String, Object> validationPlan =
        new java.util.LinkedHashMap<>(organizationValidationPlan());
    validationPlan.put("providerCallEnabled", true);
    validationPlan.put("providerCallBlocked", true);

    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), validationPlan, true, List.of());

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("providerCallEnabled", true)
        .containsEntry("providerCallBlocked", true)
        .containsEntry("manualExecutionExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains("上游 providerCall 开关未保持关闭，不能规划后置 in_app provider adapter");
  }

  @Test
  void buildPlanBlocksUnsupportedRoute() {
    Map<String, Object> plan =
        service.buildPlan(
            Map.of("route", NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS),
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
                "requestType",
                ""),
            false,
            List.of("route_supported"));

    assertThat(plan)
        .containsEntry("route", NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS)
        .containsEntry("routeSupported", false)
        .containsEntry("planStatus", "blocked")
        .containsEntry("adapterInvocationAllowed", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains("route 不是组织开通完成 notification，不能规划 in_app provider adapter");
  }

  private Map<String, Object> organizationRoutingPlan() {
    return Map.of(
        "route",
        NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
  }

  private Map<String, Object> organizationValidationPlan() {
    return Map.of(
        "route",
        NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
        "requestType",
        "OrganizationProvisioningCompletedNotificationConsumeRequest",
        "providerCallEnabled",
        false,
        "providerCallBlocked",
        false);
  }

  private void assertConsumerResultValidationPlan(Map<String, Object> plan) {
    @SuppressWarnings("unchecked")
    Map<String, Object> validationPlan =
        (Map<String, Object>) plan.get("consumerResultValidationPlan");
    assertThat(validationPlan)
        .containsEntry(
            "planType", "notification.consumer.delegation.in_app_provider_result_validation")
        .containsEntry("planStatus", "classification_dry_run")
        .containsEntry("consumerResultRequired", true)
        .containsEntry("consumerResultProvided", false)
        .containsEntry("consumerResultInspected", false)
        .containsEntry("validationExecuted", false)
        .containsEntry(
            "nextAction", "classify_real_consumer_result_before_result_adapter_executes");
    assertThat((List<Object>) validationPlan.get("sourceResultPath"))
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan");
    assertThat((List<Object>) validationPlan.get("requiredNestedPaths"))
        .contains(
            List.of("sendPlan"),
            List.of("sendPlan", "providerPlan", "inAppExecutionPlan"),
            List.of(
                "sendPlan",
                "providerPlan",
                "inAppExecutionPlan",
                "listenerAutoExecutionGatePlan",
                "invocationPlan"));
    assertThat((List<Object>) validationPlan.get("errorClassifications"))
        .anySatisfy(
            classification ->
                assertThat((Map<String, Object>) classification)
                    .containsEntry("code", "missing_in_app_execution_plan")
                    .containsEntry("adapterInvocationAllowed", false)
                    .containsEntry("manualExecutionAllowed", false))
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

  private void assertReadinessMatrix(
      Map<String, Object> plan, String expectedName, boolean expectedPassed) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix = (List<Map<String, Object>>) plan.get("readinessMatrix");
    assertThat(matrix)
        .anySatisfy(
            check ->
                assertThat(check)
                    .containsEntry("name", expectedName)
                    .containsEntry("passed", expectedPassed));
  }

  private void assertListenerNoopAckNackDecision(
      Map<String, Object> plan, String expectedScenario, boolean expectedMatched) {
    @SuppressWarnings("unchecked")
    Map<String, Object> listenerPlan =
        (Map<String, Object>) plan.get("listenerNoopIntegrationPlan");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) listenerPlan.get("ackNackDecisionMatrix");
    assertThat(matrix)
        .anySatisfy(
            decision ->
                assertThat(decision)
                    .containsEntry("scenario", expectedScenario)
                    .containsEntry("matched", expectedMatched)
                    .containsEntry("decisionExecuted", false)
                    .containsEntry("rabbitAckExecuted", false)
                    .containsEntry("rabbitNackExecuted", false));
  }

  private void assertListenerNoopValidatorContract(
      Map<String, Object> plan, String expectedStatus) {
    @SuppressWarnings("unchecked")
    Map<String, Object> listenerPlan =
        (Map<String, Object>) plan.get("listenerNoopIntegrationPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) listenerPlan.get("validatorContractPlan");
    assertThat(contractPlan)
        .containsEntry("planStatus", expectedStatus)
        .containsEntry("validatorMethod", "classify")
        .containsEntry("argumentSourceAvailable", false)
        .containsEntry("ackNackAlignmentExecuted", false)
        .containsEntry("contractCheckExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("manualExecutionAllowed", false);
    @SuppressWarnings("unchecked")
    Map<String, Object> inputAdapterPlan =
        (Map<String, Object>) contractPlan.get("inputAdapterPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> extractionPlan =
        (Map<String, Object>) inputAdapterPlan.get("consumerResultExtractionPlan");
    assertThat(extractionPlan)
        .containsEntry("planStatus", "ready_for_consumer_result_extraction_dry_run")
        .containsEntry("sourceObjectProvided", false)
        .containsEntry("extractionExecuted", false)
        .containsEntry("consumerResultConstructed", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("classificationExecuted", false);
    assertThat((List<Object>) extractionPlan.get("targetResultPath"))
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan");
    assertThat((List<Object>) contractPlan.get("inputSampleMatrix"))
        .anySatisfy(
            sample ->
                assertThat((Map<String, Object>) sample)
                    .containsEntry(
                        "sampleName", "ready_for_result_adapter_validation_sample")
                    .containsEntry(
                        "expectedClassification", "ready_for_result_adapter_validation")
                    .containsEntry("classificationExecuted", false));
  }

  private void assertAckNackAlignment(
      Map<String, Object> contractPlan, String classification, String scenario) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) contractPlan.get("ackNackAlignmentMatrix");
    assertThat(matrix)
        .anySatisfy(
            alignment ->
                assertThat(alignment)
                    .containsEntry("classification", classification)
                    .containsEntry("ackNackScenario", scenario)
                    .containsEntry("alignmentExecuted", false)
                    .containsEntry("classificationExecuted", false)
                    .containsEntry("rabbitAckExecuted", false)
                    .containsEntry("rabbitNackExecuted", false));
  }
}

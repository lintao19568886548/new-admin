package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import cn.yizuw.magic.backend.config.AppProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** listener no-op 接入预案测试；只验证 dry-run 结构和 RabbitMQ ack/nack 边界。 */
class NotificationInAppProviderListenerNoopPlanServiceTest {

  private final AppProperties appProperties = new AppProperties();
  private final NotificationInAppProviderConsumerResultValidationPlanService validationPlanService =
      new NotificationInAppProviderConsumerResultValidationPlanService();
  private final NotificationInAppProviderListenerNoopPlanService service =
      new NotificationInAppProviderListenerNoopPlanService(appProperties, validationPlanService);

  @Test
  void buildPlanBlocksWhenAdapterPlanIsNotReady() {
    Map<String, Object> plan = service.buildPlan(false);

    assertThat(plan)
        .containsEntry("planType", "notification.consumer.delegation.in_app_provider_listener_noop")
        .containsEntry("planStatus", "blocked")
        .containsEntry("adapterPlanReady", false)
        .containsEntry("listenerNoopEnabled", false)
        .containsEntry("noopBranchAllowed", false)
        .containsEntry("ackNackDecisionExecuted", false)
        .containsEntry("ackNackPolicyChanged", false);
    assertNoopPlanDoesNotExecute(plan);
    assertThat(stringList(plan.get("blockedReasons")))
        .contains(
            "result adapter dry-run 尚未 ready，不能进入 listener no-op 分支预案",
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_LISTENER_NOOP_ENABLED 未开启");
    assertAckNackDecision(plan, "adapter_plan_blocked", true);
    assertAckNackDecision(plan, "noop_gate_disabled", false);
    assertValidatorContractPlan(plan, "blocked");
  }

  @Test
  void buildPlanBlocksWhenNoopGateIsDisabledEvenIfAdapterPlanIsReady() {
    Map<String, Object> plan = service.buildPlan(true);

    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("adapterPlanReady", true)
        .containsEntry("listenerNoopEnabled", false)
        .containsEntry("noopBranchAllowed", false)
        .containsEntry("ackDecision", "keep_current_listener_policy")
        .containsEntry("nackDecision", "keep_current_listener_throw_policy")
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
    assertThat(stringList(plan.get("blockedReasons")))
        .containsExactly(
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_LISTENER_NOOP_ENABLED 未开启");
    assertAckNackDecision(plan, "adapter_plan_blocked", false);
    assertAckNackDecision(plan, "noop_gate_disabled", true);
    assertValidatorContractPlan(plan, "blocked");
  }

  @Test
  void buildPlanAllowsOnlyDryRunWhenAdapterAndNoopGateAreReady() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);

    Map<String, Object> plan = service.buildPlan(true);

    assertThat(plan)
        .containsEntry("planStatus", "ready_for_listener_noop_dry_run")
        .containsEntry("adapterPlanReady", true)
        .containsEntry("listenerNoopEnabled", true)
        .containsEntry("noopBranchAllowed", true)
        .containsEntry("noopBranchRequested", false)
        .containsEntry("websocketExecuted", false)
        .containsEntry("pushExecuted", false);
    assertNoopPlanDoesNotExecute(plan);
    assertThat(stringList(plan.get("blockedReasons"))).isEmpty();
    assertAckNackDecision(plan, "noop_branch_allowed", true);
    assertAckNackDecision(plan, "future_validation_ready", false);
    assertValidatorContractPlan(plan, "ready_for_validator_contract_dry_run");
  }

  @Test
  void buildPlanKeepsAckNackStringValuesStableAfterConstantExtraction() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);

    Map<String, Object> plan = service.buildPlan(true);

    assertThat(plan)
        .containsEntry("ackDecision", "keep_current_listener_policy")
        .containsEntry("nackDecision", "keep_current_listener_throw_policy")
        .containsEntry("ackNackDecisionExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
    assertAckNackDecisionValue(
        plan,
        "future_validation_blocked",
        "no_ack_until_real_adapter_policy_batch",
        "throw_for_retry_or_dlq_until_real_policy_batch");
    assertAckNackDecisionValue(
        plan,
        "future_validation_ready",
        "defer_ack_until_manual_execution_result_is_verified",
        "not_applicable_until_real_adapter_policy_batch");
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    assertAckNackAlignment(
        contractPlan,
        "missing_send_plan",
        "future_validation_blocked",
        "throw_for_retry_or_dlq_until_real_policy_batch");
    assertAckNackAlignment(
        contractPlan,
        "ready_for_result_adapter_validation",
        "future_validation_ready",
        "not_applicable_until_real_adapter_policy_batch");
  }

  @Test
  void buildPlanKeepsValidatorClassificationStringsStableAfterConstantExtraction() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);

    Map<String, Object> plan = service.buildPlan(true);
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");

    assertThat(contractPlan)
        .containsEntry("expectedReadyClassification", "ready_for_result_adapter_validation")
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("manualExecutionAllowed", false);
    assertThat(stringList(contractPlan.get("blockedClassifications")))
        .containsExactly(
            "missing_send_plan",
            "missing_provider_plan",
            "missing_in_app_execution_plan",
            "in_app_execution_plan_blocked",
            "missing_listener_auto_execution_invocation_plan");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> inputSamples =
        (List<Map<String, Object>>) contractPlan.get("inputSampleMatrix");
    assertThat(rowStringValues(inputSamples, "sampleName"))
        .containsExactly(
            "missing_send_plan_sample",
            "missing_provider_plan_sample",
            "missing_in_app_execution_plan_sample",
            "in_app_execution_plan_blocked_sample",
            "missing_listener_auto_execution_invocation_plan_sample",
            "ready_for_result_adapter_validation_sample");
    assertThat(rowStringValues(inputSamples, "expectedClassification"))
        .containsExactly(
            "missing_send_plan",
            "missing_provider_plan",
            "missing_in_app_execution_plan",
            "in_app_execution_plan_blocked",
            "missing_listener_auto_execution_invocation_plan",
            "ready_for_result_adapter_validation");
    assertThat(rowStringValues(inputSamples, "expectedStatus"))
        .containsExactly("blocked", "blocked", "blocked", "blocked", "blocked", "ready");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> alignmentMatrix =
        (List<Map<String, Object>>) contractPlan.get("ackNackAlignmentMatrix");
    assertThat(rowStringValues(alignmentMatrix, "classification"))
        .containsExactly(
            "missing_send_plan",
            "missing_provider_plan",
            "missing_in_app_execution_plan",
            "in_app_execution_plan_blocked",
            "missing_listener_auto_execution_invocation_plan",
            "ready_for_result_adapter_validation");
    assertThat(rowStringValues(alignmentMatrix, "ackNackScenario"))
        .containsExactly(
            "future_validation_blocked",
            "future_validation_blocked",
            "future_validation_blocked",
            "future_validation_blocked",
            "future_validation_blocked",
            "future_validation_ready");
  }

  @Test
  void buildPlanKeepsPlanStatusAndSampleNamesStableAfterConstantExtraction() {
    Map<String, Object> adapterBlockedPlan = service.buildPlan(false);
    Map<String, Object> noopDisabledPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    Map<String, Object> noopReadyPlan = service.buildPlan(true);

    assertThat(adapterBlockedPlan).containsEntry("planStatus", "blocked");
    assertThat(noopDisabledPlan).containsEntry("planStatus", "blocked");
    assertThat(noopReadyPlan).containsEntry("planStatus", "ready_for_listener_noop_dry_run");
    assertValidatorContractStatus(adapterBlockedPlan, "blocked");
    assertValidatorContractStatus(noopDisabledPlan, "blocked");
    assertValidatorContractStatus(noopReadyPlan, "ready_for_validator_contract_dry_run");

    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) noopReadyPlan.get("validatorContractPlan");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> inputSamples =
        (List<Map<String, Object>>) contractPlan.get("inputSampleMatrix");
    assertThat(rowStringValues(inputSamples, "sampleName"))
        .containsExactly(
            "missing_send_plan_sample",
            "missing_provider_plan_sample",
            "missing_in_app_execution_plan_sample",
            "in_app_execution_plan_blocked_sample",
            "missing_listener_auto_execution_invocation_plan_sample",
            "ready_for_result_adapter_validation_sample");
    assertThat(inputSamples)
        .allSatisfy(
            sample ->
                assertThat(sample)
                    .containsEntry("samplePayloadProvided", false)
                    .containsEntry("classificationExecuted", false)
                    .containsEntry("consumerResultForwardedToValidator", false)
                    .containsEntry("adapterInvocationAllowed", false)
                    .containsEntry("manualExecutionAllowed", false));
  }

  @Test
  void buildPlanKeepsNextActionAndScenarioValuesStableAfterConstantExtraction() {
    Map<String, Object> adapterBlockedPlan = service.buildPlan(false);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    Map<String, Object> noopReadyPlan = service.buildPlan(true);

    assertThat(adapterBlockedPlan)
        .containsEntry(
            "nextAction", "fix_listener_noop_branch_blockers_before_listener_integration");
    assertThat(noopReadyPlan)
        .containsEntry(
            "nextAction",
            "ready_for_future_listener_noop_branch_batch_but_current_plan_does_not_modify_listener");
    assertValidatorContractNextAction(
        adapterBlockedPlan, "fix_listener_noop_blockers_before_validator_contract_verification");
    assertValidatorContractNextAction(
        noopReadyPlan, "ready_for_future_listener_noop_to_validator_contract_verification");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) noopReadyPlan.get("ackNackDecisionMatrix");
    assertThat(rowStringValues(matrix, "scenario"))
        .containsExactly(
            "adapter_plan_blocked",
            "noop_gate_disabled",
            "noop_branch_allowed",
            "future_validation_blocked",
            "future_validation_ready");
    assertAckNackDecisionMatrixDoesNotExecute(matrix);
  }

  @Test
  void buildPlanKeepsBlockedReasonsStableAfterConstantExtraction() {
    Map<String, Object> adapterBlockedPlan = service.buildPlan(false);
    Map<String, Object> noopDisabledPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    Map<String, Object> noopReadyPlan = service.buildPlan(true);

    assertThat(stringList(adapterBlockedPlan.get("blockedReasons")))
        .containsExactly(
            "result adapter dry-run 尚未 ready，不能进入 listener no-op 分支预案",
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_LISTENER_NOOP_ENABLED 未开启");
    assertThat(stringList(noopDisabledPlan.get("blockedReasons")))
        .containsExactly(
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_LISTENER_NOOP_ENABLED 未开启");
    assertThat(stringList(noopReadyPlan.get("blockedReasons"))).isEmpty();
    assertNoopPlanDoesNotExecute(adapterBlockedPlan);
    assertNoopPlanDoesNotExecute(noopReadyPlan);
  }

  @Test
  void buildPlanKeepsExecutionBoundaryAndNotesStableAfterConstantExtraction() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);

    Map<String, Object> plan = service.buildPlan(true);

    assertThat(plan)
        .containsEntry(
            "executionBoundary", "第 185 批只生成 no-op 到 validator 的参数契约 dry-run，不修改 listener");
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    assertThat(contractPlan)
        .containsEntry(
            "executionBoundary",
            "第 188 批只输出 validator 分类与 ack/nack 对齐矩阵，不调用 validator，不改变 ack/nack")
        .containsEntry("contractCheckExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) plan.get("ackNackDecisionMatrix");
    assertThat(rowStringValues(matrix, "note"))
        .containsExactly(
            "result adapter dry-run 未 ready 时，不进入 no-op 分支，沿用当前异常路径",
            "no-op 开关关闭时，不新增 listener 分支，不改变 RabbitMQ ack/nack",
            "允许未来 no-op 分支 dry-run，但当前仍不确认或拒绝 RabbitMQ 消息",
            "未来 consumer result 校验失败时应进入显式重试/DLQ 策略批次",
            "未来 consumer result 校验通过后，仍需等手动执行结果验证再决定 ack");
    assertAckNackDecisionMatrixDoesNotExecute(matrix);
  }

  @Test
  void buildPlanDocumentsFutureValidatorClassificationToReturnThrowBoundary() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);

    Map<String, Object> plan = service.buildPlan(true);

    assertThat(plan)
        .containsEntry("ackDecision", "keep_current_listener_policy")
        .containsEntry("nackDecision", "keep_current_listener_throw_policy")
        .containsEntry("ackNackDecisionExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    assertThat(contractPlan)
        .containsEntry("ackNackAlignmentExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
    assertClassificationReturnThrowBoundary(
        contractPlan,
        "missing_send_plan",
        "future_validation_blocked",
        "no_ack_until_real_adapter_policy_batch",
        "throw_for_retry_or_dlq_until_real_policy_batch");
    assertClassificationReturnThrowBoundary(
        contractPlan,
        "missing_provider_plan",
        "future_validation_blocked",
        "no_ack_until_real_adapter_policy_batch",
        "throw_for_retry_or_dlq_until_real_policy_batch");
    assertClassificationReturnThrowBoundary(
        contractPlan,
        "missing_in_app_execution_plan",
        "future_validation_blocked",
        "no_ack_until_real_adapter_policy_batch",
        "throw_for_retry_or_dlq_until_real_policy_batch");
    assertClassificationReturnThrowBoundary(
        contractPlan,
        "in_app_execution_plan_blocked",
        "future_validation_blocked",
        "no_ack_until_real_adapter_policy_batch",
        "throw_for_retry_or_dlq_until_real_policy_batch");
    assertClassificationReturnThrowBoundary(
        contractPlan,
        "missing_listener_auto_execution_invocation_plan",
        "future_validation_blocked",
        "no_ack_until_real_adapter_policy_batch",
        "throw_for_retry_or_dlq_until_real_policy_batch");
    assertClassificationReturnThrowBoundary(
        contractPlan,
        "ready_for_result_adapter_validation",
        "future_validation_ready",
        "defer_ack_until_manual_execution_result_is_verified",
        "not_applicable_until_real_adapter_policy_batch");
  }

  @Test
  void buildPlanDocumentsValidatorInputAdapterContractWithoutForwardingResult() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);

    Map<String, Object> plan = service.buildPlan(true);
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> inputAdapterPlan =
        (Map<String, Object>) contractPlan.get("inputAdapterPlan");

    assertThat(inputAdapterPlan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider_listener_noop.validator_input_adapter")
        .containsEntry("planStatus", "ready_for_validator_input_adapter_dry_run")
        .containsEntry("sourceObject", "dedicatedConsumerResult")
        .containsEntry("sourceObjectAvailable", false)
        .containsEntry(
            "targetValidatorBean", "notificationInAppProviderConsumerResultValidationPlanService")
        .containsEntry("targetValidatorMethod", "classify")
        .containsEntry("targetArgumentName", "consumerResult")
        .containsEntry("targetArgumentType", "Map<String,Object>")
        .containsEntry("adapterRequested", false)
        .containsEntry("adapterExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry(
            "nextAction", "ready_for_future_validator_input_adapter_contract_verification");
    assertThat(stringList(inputAdapterPlan.get("sourceResultPath")))
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan");
    assertThat(stringPathList(inputAdapterPlan.get("requiredNestedPaths")))
        .contains(
            List.of("sendPlan"),
            List.of("sendPlan", "providerPlan"),
            List.of("sendPlan", "providerPlan", "inAppExecutionPlan"));
  }

  @Test
  void buildPlanDocumentsConsumerResultExtractionDryRunWithoutReadingResult() {
    Map<String, Object> blockedPlan = service.buildPlan(false);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    Map<String, Object> readyPlan = service.buildPlan(true);

    assertConsumerResultExtractionPlan(
        blockedPlan,
        "blocked",
        "keep_extraction_blocked_until_listener_noop_ready",
        "fix_listener_noop_blockers_before_consumer_result_extraction");
    assertConsumerResultExtractionPlan(
        readyPlan,
        "ready_for_consumer_result_extraction_dry_run",
        "throw_before_classify_until_real_adapter_policy_batch",
        "ready_for_future_real_consumer_result_extraction_batch");
  }

  @Test
  void buildPlanKeepsInputAdapterBlockedUntilListenerNoopIsReady() {
    Map<String, Object> adapterBlockedPlan = service.buildPlan(false);
    Map<String, Object> noopDisabledPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    Map<String, Object> noopReadyPlan = service.buildPlan(true);

    assertInputAdapterPlanStatus(adapterBlockedPlan, "blocked");
    assertInputAdapterPlanStatus(noopDisabledPlan, "blocked");
    assertInputAdapterPlanStatus(noopReadyPlan, "ready_for_validator_input_adapter_dry_run");
  }

  @Test
  void buildPlanKeepsInputAdapterRequiredPathOrderStable() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);

    Map<String, Object> plan = service.buildPlan(true);
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> inputAdapterPlan =
        (Map<String, Object>) contractPlan.get("inputAdapterPlan");

    assertThat(stringList(inputAdapterPlan.get("sourceResultPath")))
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan");
    assertThat(stringPathList(inputAdapterPlan.get("requiredNestedPaths")))
        .containsExactly(
            List.of("sendPlan"),
            List.of("sendPlan", "providerPlan"),
            List.of("sendPlan", "providerPlan", "inAppExecutionPlan"),
            List.of(
                "sendPlan",
                "providerPlan",
                "inAppExecutionPlan",
                "listenerAutoExecutionGatePlan"),
            List.of(
                "sendPlan",
                "providerPlan",
                "inAppExecutionPlan",
                "listenerAutoExecutionGatePlan",
                "invocationPlan"));
    assertThat(inputAdapterPlan)
        .containsEntry("sourceObjectAvailable", false)
        .containsEntry("adapterExecuted", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false);
  }

  @Test
  void buildPlanKeepsInputAdapterNextActionAndExecutionFlagsStable() {
    Map<String, Object> adapterBlockedPlan = service.buildPlan(false);
    Map<String, Object> noopDisabledPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    Map<String, Object> noopReadyPlan = service.buildPlan(true);

    assertInputAdapterNextAction(
        adapterBlockedPlan, "fix_listener_noop_blockers_before_validator_input_adapter");
    assertInputAdapterNextAction(
        noopDisabledPlan, "fix_listener_noop_blockers_before_validator_input_adapter");
    assertInputAdapterNextAction(
        noopReadyPlan, "ready_for_future_validator_input_adapter_contract_verification");
  }

  @Test
  void buildPlanDocumentsValidatorInvocationGateWithoutCallingClassify() {
    Map<String, Object> blockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled(true);
    Map<String, Object> readyPlan = service.buildPlan(true);

    assertValidatorInvocationGate(
        blockedPlan,
        "blocked",
        false,
        false,
        "keep_validator_invocation_blocked_until_gate_ready");
    assertValidatorInvocationGate(
        readyPlan,
        "ready_for_validator_invocation_dry_run",
        true,
        true,
        "ready_for_future_validator_invocation_batch_but_current_plan_does_not_call_classify");
  }

  @Test
  void buildPlanDocumentsClassificationBridgeGateWithoutInvokingBridge() {
    Map<String, Object> blockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled(true);
    Map<String, Object> readyPlan = service.buildPlan(true);

    assertClassificationBridgeGate(
        blockedPlan,
        "blocked",
        false,
        "keep_classification_bridge_blocked_until_validator_gate_ready");
    assertClassificationBridgeGate(
        readyPlan,
        "ready_for_classification_bridge_dry_run",
        true,
        "ready_for_future_classification_bridge_listener_integration_batch");
  }

  @Test
  void buildPlanDocumentsClassificationBridgeOutcomeDecisionMatrixWithoutExecutingBridge() {
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled(true);
    Map<String, Object> plan = service.buildPlan(true);
    Map<String, Object> bridgeGatePlan = classificationBridgeGatePlan(plan);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) bridgeGatePlan.get("bridgeOutcomeDecisionMatrix");
    assertThat(matrix).hasSize(3);
    assertThat(rowStringValues(matrix, "scenario"))
        .containsExactly(
            "adapter_blocked_before_validation",
            "future_validation_blocked",
            "future_validation_ready");
    assertThat(rowStringValues(matrix, "futureReturnThrowDecision"))
        .containsExactly(
            "throw_before_classify_until_real_adapter_policy_batch",
            "throw_for_retry_or_dlq_until_real_policy_batch",
            "return_deferred_until_manual_execution_result_is_verified");
    assertThat(rowStringValues(matrix, "ackDecision"))
        .containsExactly(
            "no_ack_until_real_adapter_policy_batch",
            "no_ack_until_real_adapter_policy_batch",
            "defer_ack_until_manual_execution_result_is_verified");
    assertThat(rowStringValues(matrix, "nackDecision"))
        .containsExactly(
            "throw_for_retry_or_dlq_until_real_policy_batch",
            "throw_for_retry_or_dlq_until_real_policy_batch",
            "not_applicable_until_real_adapter_policy_batch");
    assertThat(matrix)
        .allSatisfy(
            decision ->
                assertThat(decision)
                    .containsEntry("bridgeInvocationExecuted", false)
                    .containsEntry("decisionExecuted", false)
                    .containsEntry("rabbitAckExecuted", false)
                    .containsEntry("rabbitNackExecuted", false));
  }

  @Test
  void buildPlanDocumentsBridgeResultObservationPlanWithoutChangingListenerPolicy() {
    Map<String, Object> blockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled(true);
    Map<String, Object> readyPlan = service.buildPlan(true);

    assertBridgeResultObservationPlan(
        blockedPlan,
        "blocked",
        false,
        "keep_bridge_result_observation_blocked_until_bridge_gate_ready");
    assertBridgeResultObservationPlan(
        readyPlan,
        "ready_for_bridge_result_observation_dry_run",
        true,
        "ready_for_future_bridge_result_observation_logging_batch");
  }

  @Test
  void buildPlanKeepsBridgeReturnThrowPolicySwitchBehindSeparateGate() {
    Map<String, Object> allBlockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled(true);
    Map<String, Object> bridgeReadyPolicyBlockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeReturnThrowEnabled(true);
    Map<String, Object> policyReadyPlan = service.buildPlan(true);

    assertBridgeReturnThrowPolicyGate(
        allBlockedPlan,
        "blocked",
        false,
        false,
        false,
        List.of(
            "classification bridge dry-run 尚未 ready，不能规划 listener return/throw 切换",
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_RETURN_THROW_ENABLED 未开启"),
        "keep_listener_return_throw_policy_switch_blocked_until_gate_ready");
    assertBridgeReturnThrowPolicyGate(
        bridgeReadyPolicyBlockedPlan,
        "blocked",
        true,
        false,
        false,
        List.of(
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_RETURN_THROW_ENABLED 未开启"),
        "keep_listener_return_throw_policy_switch_blocked_until_gate_ready");
    assertBridgeReturnThrowPolicyGate(
        policyReadyPlan,
        "ready_for_bridge_return_throw_policy_dry_run",
        true,
        true,
        true,
        List.of(),
        "ready_for_future_listener_return_throw_policy_switch_batch");
  }

  @Test
  void buildPlanKeepsBridgeDecisionDryRunInvocationBehindSeparateGate() {
    Map<String, Object> allBlockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled(true);
    Map<String, Object> bridgeReadyDecisionBlockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled(true);
    Map<String, Object> decisionReadyPlan = service.buildPlan(true);

    assertBridgeDecisionDryRunInvocationGate(
        allBlockedPlan,
        "blocked",
        false,
        false,
        false,
        List.of(
            "classification bridge dry-run 尚未 ready，不能规划 listener 只读 decision dry-run 调用",
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_ENABLED 未开启"),
        "keep_listener_decision_dry_run_invocation_blocked_until_gate_ready");
    assertBridgeDecisionDryRunInvocationGate(
        bridgeReadyDecisionBlockedPlan,
        "blocked",
        true,
        false,
        false,
        List.of(
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_ENABLED 未开启"),
        "keep_listener_decision_dry_run_invocation_blocked_until_gate_ready");
    assertBridgeDecisionDryRunInvocationGate(
        decisionReadyPlan,
        "ready_for_bridge_return_throw_decision_dry_run_listener_invocation",
        true,
        true,
        true,
        List.of(),
        "ready_for_future_listener_read_only_decision_dry_run_invocation_batch");
  }

  @Test
  void buildPlanKeepsDecisionOutputObservationLoggingBehindSeparateGate() {
    Map<String, Object> allBlockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled(true);
    Map<String, Object> decisionReadyLoggingBlockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled(
            true);
    Map<String, Object> loggingReadyPlan = service.buildPlan(true);

    assertDecisionOutputObservationLoggingGate(
        allBlockedPlan,
        "blocked",
        false,
        false,
        false,
        List.of(
            "decision dry-run listener 调用尚未 ready，不能规划 observation logging",
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_OBSERVATION_LOG_ENABLED 未开启"),
        "keep_decision_output_observation_logging_blocked_until_gate_ready");
    assertDecisionOutputObservationLoggingGate(
        decisionReadyLoggingBlockedPlan,
        "blocked",
        true,
        false,
        false,
        List.of(
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_OBSERVATION_LOG_ENABLED 未开启"),
        "keep_decision_output_observation_logging_blocked_until_gate_ready");
    assertDecisionOutputObservationLoggingGate(
        loggingReadyPlan,
        "ready_for_bridge_return_throw_decision_output_observation_logging",
        true,
        true,
        true,
        List.of(),
        "ready_for_future_bridge_return_throw_decision_observation_logging_batch");
  }

  @Test
  void buildPlanDescribesDecisionOutputObservationLoggingPayloadWithoutBuildingIt() {
    Map<String, Object> allBlockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled(
            true);
    Map<String, Object> loggingReadyPlan = service.buildPlan(true);

    assertDecisionOutputObservationLoggingPayloadPlan(
        allBlockedPlan,
        "blocked",
        false,
        "keep_decision_output_observation_logging_payload_blocked_until_gate_ready");
    assertDecisionOutputObservationLoggingPayloadPlan(
        loggingReadyPlan,
        "ready_for_bridge_return_throw_decision_output_observation_logging_payload",
        true,
        "ready_for_future_bridge_return_throw_decision_observation_payload_logging_batch");
  }

  @Test
  void buildPlanKeepsClassificationBridgeGateBlockedReasonsStable() {
    Map<String, Object> allBlockedPlan = service.buildPlan(false);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(true);
    Map<String, Object> bridgeDisabledPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled(true);
    Map<String, Object> readyPlan = service.buildPlan(true);

    assertClassificationBridgeGateBlockedReasons(
        allBlockedPlan,
        List.of(
            "validator invocation dry-run 尚未 ready，不能规划 classification bridge 调用",
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_ENABLED 未开启"));
    assertClassificationBridgeGateBlockedReasons(
        bridgeDisabledPlan,
        List.of(
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_ENABLED 未开启"));
    assertClassificationBridgeGateBlockedReasons(readyPlan, List.of());
  }

  @Test
  void buildPlanKeepsValidatorInvocationGateBlockedReasonsStable() {
    Map<String, Object> allBlockedPlan = service.buildPlan(false);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(true);
    Map<String, Object> noopBlockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    Map<String, Object> readyPlan = service.buildPlan(true);

    assertValidatorInvocationGateBlockedReasons(
        allBlockedPlan,
        List.of(
            "listener no-op dry-run 尚未 ready，不能规划 validator 调用",
            "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_VALIDATOR_ENABLED 未开启"));
    assertValidatorInvocationGateBlockedReasons(
        noopBlockedPlan, List.of("listener no-op dry-run 尚未 ready，不能规划 validator 调用"));
    assertValidatorInvocationGateBlockedReasons(readyPlan, List.of());
  }

  @Test
  void buildPlanDocumentsClassificationAckNackPlanWithoutExecutingDecision() {
    Map<String, Object> blockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(true);
    Map<String, Object> readyPlan = service.buildPlan(true);

    assertClassificationAckNackPlan(blockedPlan, "blocked");
    assertClassificationAckNackPlan(readyPlan, "ready_for_classification_ack_nack_dry_run");
  }

  @Test
  void buildPlanKeepsClassificationAckNackPlanClassificationsAndNextActionStable() {
    Map<String, Object> blockedPlan = service.buildPlan(true);

    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled(true);
    appProperties
        .getRabbitMq()
        .setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(true);
    Map<String, Object> readyPlan = service.buildPlan(true);

    assertClassificationAckNackPlanNextAction(
        blockedPlan, "keep_classification_ack_nack_blocked_until_validator_gate_ready");
    assertClassificationAckNackPlanNextAction(
        readyPlan, "ready_for_future_classification_to_ack_nack_policy_batch");
    assertClassificationAckNackDecisionOrder(readyPlan);
  }

  private void assertAckNackDecision(
      Map<String, Object> plan, String expectedScenario, boolean expectedMatched) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) plan.get("ackNackDecisionMatrix");
    assertThat(matrix)
        .anySatisfy(
            decision -> {
                assertThat(decision)
                    .containsEntry("scenario", expectedScenario)
                    .containsEntry("matched", expectedMatched);
                assertAckNackDecisionDoesNotExecute(decision);
            });
  }

  private void assertAckNackDecisionMatrixDoesNotExecute(List<Map<String, Object>> matrix) {
    assertThat(matrix).allSatisfy(this::assertAckNackDecisionDoesNotExecute);
  }

  private void assertAckNackDecisionDoesNotExecute(Map<String, Object> decision) {
    assertThat(decision)
        .containsEntry("decisionExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
  }

  private void assertNoopPlanDoesNotExecute(Map<String, Object> plan) {
    assertThat(plan)
        .containsEntry("noopBranchExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
  }

  private void assertAckNackDecisionValue(
      Map<String, Object> plan,
      String expectedScenario,
      String expectedAckDecision,
      String expectedNackDecision) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) plan.get("ackNackDecisionMatrix");
    assertThat(matrix)
        .anySatisfy(
            decision -> {
                assertThat(decision)
                    .containsEntry("scenario", expectedScenario)
                    .containsEntry("ackDecision", expectedAckDecision)
                    .containsEntry("nackDecision", expectedNackDecision);
                assertAckNackDecisionDoesNotExecute(decision);
            });
  }

  private void assertValidatorContractPlan(Map<String, Object> plan, String expectedStatus) {
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    assertThat(contractPlan)
        .containsEntry("planStatus", expectedStatus)
        .containsEntry("validatorMethod", "classify")
        .containsEntry("argumentName", "consumerResult")
        .containsEntry("argumentSource", "dedicatedConsumerResult")
        .containsEntry("argumentSourceAvailable", false)
        .containsEntry("expectedReadyClassification", "ready_for_result_adapter_validation")
        .containsEntry("contractCheckExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
    assertThat(stringList(contractPlan.get("sourceResultPath")))
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan");
    assertThat(stringList(contractPlan.get("blockedClassifications")))
        .contains(
            "missing_send_plan",
            "in_app_execution_plan_blocked",
            "missing_listener_auto_execution_invocation_plan");
    assertInputSample(contractPlan, "missing_send_plan_sample", "missing_send_plan", "blocked");
    assertInputSample(
        contractPlan,
        "ready_for_result_adapter_validation_sample",
        "ready_for_result_adapter_validation",
        "ready");
    assertAckNackAlignment(
        contractPlan,
        "missing_send_plan",
        "future_validation_blocked",
        "throw_for_retry_or_dlq_until_real_policy_batch");
    assertAckNackAlignment(
        contractPlan,
        "ready_for_result_adapter_validation",
        "future_validation_ready",
        "not_applicable_until_real_adapter_policy_batch");
  }

  private void assertInputSample(
      Map<String, Object> contractPlan,
      String expectedSampleName,
      String expectedClassification,
      String expectedStatus) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) contractPlan.get("inputSampleMatrix");
    assertThat(matrix)
        .anySatisfy(
            sample ->
                assertThat(sample)
                    .containsEntry("sampleName", expectedSampleName)
                    .containsEntry("expectedClassification", expectedClassification)
                    .containsEntry("expectedStatus", expectedStatus)
                    .containsEntry("samplePayloadProvided", false)
                    .containsEntry("classificationExecuted", false)
                    .containsEntry("consumerResultForwardedToValidator", false)
                    .containsEntry("rabbitAckExecuted", false)
                    .containsEntry("rabbitNackExecuted", false));
  }

  private void assertValidatorContractStatus(
      Map<String, Object> plan, String expectedPlanStatus) {
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    assertThat(contractPlan)
        .containsEntry("planStatus", expectedPlanStatus)
        .containsEntry("contractCheckExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
  }

  private void assertValidatorContractNextAction(
      Map<String, Object> plan, String expectedNextAction) {
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    assertThat(contractPlan)
        .containsEntry("nextAction", expectedNextAction)
        .containsEntry("contractCheckExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
  }

  private void assertConsumerResultExtractionPlan(
      Map<String, Object> plan,
      String expectedPlanStatus,
      String expectedFailureStrategy,
      String expectedNextAction) {
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> inputAdapterPlan =
        (Map<String, Object>) contractPlan.get("inputAdapterPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> extractionPlan =
        (Map<String, Object>) inputAdapterPlan.get("consumerResultExtractionPlan");

    assertThat(extractionPlan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider_listener_noop.consumer_result_extraction")
        .containsEntry("planStatus", expectedPlanStatus)
        .containsEntry("sourceObject", "dedicatedConsumerResult")
        .containsEntry(
            "sourceObjectType", "OrganizationProvisioningCompletedNotificationConsumeResult")
        .containsEntry("sourceObjectProvided", false)
        .containsEntry("targetArgumentName", "consumerResult")
        .containsEntry("targetArgumentType", "Map<String,Object>")
        .containsEntry("extractionRequested", false)
        .containsEntry("extractionExecuted", false)
        .containsEntry("consumerResultConstructed", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("failureStrategy", expectedFailureStrategy)
        .containsEntry("nextAction", expectedNextAction);
    assertThat(stringList(extractionPlan.get("targetResultPath")))
        .containsExactly("sendPlan", "providerPlan", "inAppExecutionPlan");
  }

  private void assertInputAdapterPlanStatus(
      Map<String, Object> plan, String expectedPlanStatus) {
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> inputAdapterPlan =
        (Map<String, Object>) contractPlan.get("inputAdapterPlan");
    assertThat(inputAdapterPlan)
        .containsEntry("planStatus", expectedPlanStatus)
        .containsEntry("adapterRequested", false)
        .containsEntry("adapterExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
  }

  private void assertInputAdapterNextAction(
      Map<String, Object> plan, String expectedNextAction) {
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> inputAdapterPlan =
        (Map<String, Object>) contractPlan.get("inputAdapterPlan");
    assertThat(inputAdapterPlan)
        .containsEntry("nextAction", expectedNextAction)
        .containsEntry("adapterRequested", false)
        .containsEntry("adapterExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
  }

  private void assertValidatorInvocationGate(
      Map<String, Object> plan,
      String expectedPlanStatus,
      boolean expectedListenerNoopReady,
      boolean expectedAllowed,
      String expectedNextAction) {
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> inputAdapterPlan =
        (Map<String, Object>) contractPlan.get("inputAdapterPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> gatePlan =
        (Map<String, Object>) inputAdapterPlan.get("validatorInvocationGatePlan");
    assertThat(gatePlan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider_listener_noop.validator_invocation_gate")
        .containsEntry("planStatus", expectedPlanStatus)
        .containsEntry("listenerNoopReady", expectedListenerNoopReady)
        .containsEntry("validatorInvocationAllowed", expectedAllowed)
        .containsEntry("validatorInvocationRequested", false)
        .containsEntry("validatorInvocationExecuted", false)
        .containsEntry("consumerResultProvided", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("nextAction", expectedNextAction);
  }

  private void assertValidatorInvocationGateBlockedReasons(
      Map<String, Object> plan, List<String> expectedReasons) {
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> inputAdapterPlan =
        (Map<String, Object>) contractPlan.get("inputAdapterPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> gatePlan =
        (Map<String, Object>) inputAdapterPlan.get("validatorInvocationGatePlan");
    assertThat(stringList(gatePlan.get("blockedReasons"))).containsExactlyElementsOf(expectedReasons);
    assertThat(gatePlan)
        .containsEntry("validatorInvocationRequested", false)
        .containsEntry("validatorInvocationExecuted", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("manualExecutionAllowed", false);
  }

  private void assertClassificationBridgeGate(
      Map<String, Object> plan,
      String expectedPlanStatus,
      boolean expectedAllowed,
      String expectedNextAction) {
    Map<String, Object> bridgeGatePlan = classificationBridgeGatePlan(plan);
    assertThat(bridgeGatePlan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider_listener_noop.classification_bridge_gate")
        .containsEntry("planStatus", expectedPlanStatus)
        .containsEntry("validatorInvocationReady", expectedAllowed)
        .containsEntry(
            "bridgeBean", "notificationInAppProviderConsumerResultClassificationBridgeService")
        .containsEntry("bridgeMethod", "classifyDryRun")
        .containsEntry("bridgeInvocationAllowed", expectedAllowed)
        .containsEntry("bridgeInvocationRequested", false)
        .containsEntry("bridgeInvocationExecuted", false)
        .containsEntry("consumerResultForwardedToBridge", false)
        .containsEntry("adapterExecuted", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("nextAction", expectedNextAction);
  }

  private void assertClassificationBridgeGateBlockedReasons(
      Map<String, Object> plan, List<String> expectedReasons) {
    Map<String, Object> bridgeGatePlan = classificationBridgeGatePlan(plan);
    assertThat(stringList(bridgeGatePlan.get("blockedReasons")))
        .containsExactlyElementsOf(expectedReasons);
    assertThat(bridgeGatePlan)
        .containsEntry("bridgeInvocationRequested", false)
        .containsEntry("bridgeInvocationExecuted", false)
        .containsEntry("consumerResultForwardedToBridge", false)
        .containsEntry("adapterExecuted", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("manualExecutionAllowed", false);
  }

  private Map<String, Object> classificationBridgeGatePlan(Map<String, Object> plan) {
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> inputAdapterPlan =
        (Map<String, Object>) contractPlan.get("inputAdapterPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> gatePlan =
        (Map<String, Object>) inputAdapterPlan.get("validatorInvocationGatePlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> bridgeGatePlan =
        (Map<String, Object>) gatePlan.get("classificationBridgeGatePlan");
    return bridgeGatePlan;
  }

  private void assertBridgeResultObservationPlan(
      Map<String, Object> plan,
      String expectedPlanStatus,
      boolean expectedBridgeInvocationReady,
      String expectedNextAction) {
    Map<String, Object> observationPlan = bridgeResultObservationPlan(plan);
    assertThat(observationPlan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider_listener_noop.classification_bridge_result_observation")
        .containsEntry("planStatus", expectedPlanStatus)
        .containsEntry("bridgeInvocationReady", expectedBridgeInvocationReady)
        .containsEntry(
            "observationSource",
            "NotificationInAppProviderConsumerResultClassificationBridgeService.classifyDryRun")
        .containsEntry("logMessageKey", "notification.in_app_provider.bridge_result_dry_run")
        .containsEntry("observationRequested", false)
        .containsEntry("observationExecuted", false)
        .containsEntry("bridgeResultObserved", false)
        .containsEntry("logPlanned", expectedBridgeInvocationReady)
        .containsEntry("logExecuted", false)
        .containsEntry("databaseWriteExecuted", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("returnThrowPolicyChanged", false)
        .containsEntry("ackNackPolicyChanged", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("nextAction", expectedNextAction);
    assertThat(stringList(observationPlan.get("observedFields")))
        .containsExactly(
            "classificationStatus",
            "futureReturnThrowDecision",
            "ackDecision",
            "nackDecision",
            "adapterPlanStatus",
            "validationClassification",
            "blockedReasons");
  }

  private Map<String, Object> bridgeResultObservationPlan(Map<String, Object> plan) {
    Map<String, Object> bridgeGatePlan = classificationBridgeGatePlan(plan);
    @SuppressWarnings("unchecked")
    Map<String, Object> observationPlan =
        (Map<String, Object>) bridgeGatePlan.get("bridgeResultObservationPlan");
    return observationPlan;
  }

  private void assertBridgeReturnThrowPolicyGate(
      Map<String, Object> plan,
      String expectedPlanStatus,
      boolean expectedBridgeInvocationReady,
      boolean expectedPolicyGateEnabled,
      boolean expectedPolicyChangeAllowed,
      List<String> expectedBlockedReasons,
      String expectedNextAction) {
    Map<String, Object> policyGatePlan = bridgeReturnThrowPolicyGatePlan(plan);
    assertThat(policyGatePlan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider_listener_noop.classification_bridge_return_throw_policy_gate")
        .containsEntry("planStatus", expectedPlanStatus)
        .containsEntry("bridgeInvocationReady", expectedBridgeInvocationReady)
        .containsEntry("returnThrowPolicyGateEnabled", expectedPolicyGateEnabled)
        .containsEntry("returnThrowPolicyChangeAllowed", expectedPolicyChangeAllowed)
        .containsEntry("returnThrowPolicyChangeRequested", false)
        .containsEntry("returnThrowPolicyChanged", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("bridgeResultObserved", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("nextAction", expectedNextAction);
    assertThat(stringList(policyGatePlan.get("blockedReasons")))
        .containsExactlyElementsOf(expectedBlockedReasons);
  }

  private Map<String, Object> bridgeReturnThrowPolicyGatePlan(Map<String, Object> plan) {
    Map<String, Object> bridgeGatePlan = classificationBridgeGatePlan(plan);
    @SuppressWarnings("unchecked")
    Map<String, Object> policyGatePlan =
        (Map<String, Object>) bridgeGatePlan.get("bridgeReturnThrowPolicyGatePlan");
    return policyGatePlan;
  }

  private void assertBridgeDecisionDryRunInvocationGate(
      Map<String, Object> plan,
      String expectedPlanStatus,
      boolean expectedBridgeInvocationReady,
      boolean expectedDecisionDryRunGateEnabled,
      boolean expectedInvocationAllowed,
      List<String> expectedBlockedReasons,
      String expectedNextAction) {
    Map<String, Object> invocationGatePlan = bridgeDecisionDryRunInvocationGatePlan(plan);
    assertThat(invocationGatePlan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider_listener_noop.bridge_return_throw_decision_dry_run_invocation_gate")
        .containsEntry("planStatus", expectedPlanStatus)
        .containsEntry("bridgeInvocationReady", expectedBridgeInvocationReady)
        .containsEntry("decisionDryRunGateEnabled", expectedDecisionDryRunGateEnabled)
        .containsEntry("decisionDryRunInvocationAllowed", expectedInvocationAllowed)
        .containsEntry("decisionDryRunInvocationRequested", false)
        .containsEntry("decisionDryRunInvocationExecuted", false)
        .containsEntry(
            "decisionDryRunBean",
            "notificationInAppProviderBridgeReturnThrowDecisionDryRunService")
        .containsEntry("decisionDryRunMethod", "decideDryRun")
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("decisionApplied", false)
        .containsEntry("throwRequested", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("nextAction", expectedNextAction);
    assertThat(stringList(invocationGatePlan.get("blockedReasons")))
        .containsExactlyElementsOf(expectedBlockedReasons);
  }

  private Map<String, Object> bridgeDecisionDryRunInvocationGatePlan(Map<String, Object> plan) {
    Map<String, Object> bridgeGatePlan = classificationBridgeGatePlan(plan);
    @SuppressWarnings("unchecked")
    Map<String, Object> invocationGatePlan =
        (Map<String, Object>) bridgeGatePlan.get("bridgeDecisionDryRunInvocationGatePlan");
    return invocationGatePlan;
  }

  private void assertDecisionOutputObservationLoggingGate(
      Map<String, Object> plan,
      String expectedPlanStatus,
      boolean expectedDecisionDryRunInvocationReady,
      boolean expectedLoggingGateEnabled,
      boolean expectedLoggingAllowed,
      List<String> expectedBlockedReasons,
      String expectedNextAction) {
    Map<String, Object> loggingGatePlan = decisionOutputObservationLoggingGatePlan(plan);
    assertThat(loggingGatePlan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider_listener_noop.bridge_return_throw_decision_output_observation_logging_gate")
        .containsEntry("planStatus", expectedPlanStatus)
        .containsEntry("decisionDryRunInvocationReady", expectedDecisionDryRunInvocationReady)
        .containsEntry("observationLoggingGateEnabled", expectedLoggingGateEnabled)
        .containsEntry("observationLoggingAllowed", expectedLoggingAllowed)
        .containsEntry("observationPlanField", "decisionOutputObservationPlan")
        .containsEntry(
            "logMessageKey",
            "notification.in_app_provider.bridge_return_throw_decision_dry_run")
        .containsEntry("observationLoggingRequested", false)
        .containsEntry("observationLoggingExecuted", false)
        .containsEntry("logExecuted", false)
        .containsEntry("databaseWriteExecuted", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("decisionApplied", false)
        .containsEntry("throwRequested", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("nextAction", expectedNextAction);
    assertThat(stringList(loggingGatePlan.get("blockedReasons")))
        .containsExactlyElementsOf(expectedBlockedReasons);
  }

  private Map<String, Object> decisionOutputObservationLoggingGatePlan(
      Map<String, Object> plan) {
    Map<String, Object> invocationGatePlan = bridgeDecisionDryRunInvocationGatePlan(plan);
    @SuppressWarnings("unchecked")
    Map<String, Object> loggingGatePlan =
        (Map<String, Object>) invocationGatePlan.get("decisionOutputObservationLoggingGatePlan");
    return loggingGatePlan;
  }

  private void assertDecisionOutputObservationLoggingPayloadPlan(
      Map<String, Object> plan,
      String expectedPlanStatus,
      boolean expectedLoggingGateReady,
      String expectedNextAction) {
    Map<String, Object> payloadPlan = decisionOutputObservationLoggingPayloadPlan(plan);
    assertThat(payloadPlan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider_listener_noop.bridge_return_throw_decision_output_observation_logging_payload")
        .containsEntry("planStatus", expectedPlanStatus)
        .containsEntry("loggingGateReady", expectedLoggingGateReady)
        .containsEntry("sourcePlanField", "decisionOutputObservationPlan")
        .containsEntry("payloadBuildRequested", false)
        .containsEntry("payloadBuildExecuted", false)
        .containsEntry("payloadWritten", false)
        .containsEntry("logExecuted", false)
        .containsEntry("databaseWriteExecuted", false)
        .containsEntry("listenerPolicyChanged", false)
        .containsEntry("decisionApplied", false)
        .containsEntry("throwRequested", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("nextAction", expectedNextAction);
    assertThat(stringList(payloadPlan.get("payloadFields")))
        .containsExactly(
            "eventId",
            "idempotencyKey",
            "bridgeResult.classificationStatus",
            "bridgeResult.futureReturnThrowDecision",
            "policyDecisionPlan.planStatus",
            "policyDecisionPlan.futureListenerDecision",
            "policyDecisionPlan.decisionApplied",
            "blockedReasons",
            "logMessageKey");
  }

  private Map<String, Object> decisionOutputObservationLoggingPayloadPlan(
      Map<String, Object> plan) {
    Map<String, Object> loggingGatePlan = decisionOutputObservationLoggingGatePlan(plan);
    @SuppressWarnings("unchecked")
    Map<String, Object> payloadPlan =
        (Map<String, Object>) loggingGatePlan.get("observationLoggingPayloadPlan");
    return payloadPlan;
  }

  private void assertClassificationAckNackPlan(
      Map<String, Object> plan, String expectedPlanStatus) {
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> inputAdapterPlan =
        (Map<String, Object>) contractPlan.get("inputAdapterPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> gatePlan =
        (Map<String, Object>) inputAdapterPlan.get("validatorInvocationGatePlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> ackNackPlan =
        (Map<String, Object>) gatePlan.get("classificationAckNackPlan");
    assertThat(ackNackPlan)
        .containsEntry(
            "planType",
            "notification.consumer.delegation.in_app_provider_listener_noop.classification_ack_nack")
        .containsEntry("planStatus", expectedPlanStatus)
        .containsEntry("classificationExecuted", false)
        .containsEntry("ackNackDecisionExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("manualExecutionAllowed", false);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) ackNackPlan.get("decisionMatrix");
    assertThat(matrix)
        .hasSize(2)
        .anySatisfy(
            decision ->
                assertThat(decision)
                    .containsEntry("scenario", "future_validation_blocked")
                    .containsEntry("ackDecision", "no_ack_until_real_adapter_policy_batch")
                    .containsEntry("nackDecision", "throw_for_retry_or_dlq_until_real_policy_batch")
                    .containsEntry("classificationExecuted", false)
                    .containsEntry("decisionExecuted", false)
                    .containsEntry("rabbitAckExecuted", false)
                    .containsEntry("rabbitNackExecuted", false))
        .anySatisfy(
            decision ->
                assertThat(decision)
                    .containsEntry("scenario", "future_validation_ready")
                    .containsEntry("ackDecision", "defer_ack_until_manual_execution_result_is_verified")
                    .containsEntry("nackDecision", "not_applicable_until_real_adapter_policy_batch")
                    .containsEntry("classificationExecuted", false)
                    .containsEntry("decisionExecuted", false)
                    .containsEntry("rabbitAckExecuted", false)
                    .containsEntry("rabbitNackExecuted", false));
  }

  private void assertClassificationAckNackPlanNextAction(
      Map<String, Object> plan, String expectedNextAction) {
    Map<String, Object> ackNackPlan = classificationAckNackPlan(plan);
    assertThat(ackNackPlan)
        .containsEntry("nextAction", expectedNextAction)
        .containsEntry("classificationExecuted", false)
        .containsEntry("ackNackDecisionExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
  }

  private void assertClassificationAckNackDecisionOrder(Map<String, Object> plan) {
    Map<String, Object> ackNackPlan = classificationAckNackPlan(plan);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) ackNackPlan.get("decisionMatrix");
    assertThat(rowStringValues(matrix, "scenario"))
        .containsExactly("future_validation_blocked", "future_validation_ready");
    assertThat(stringList(matrix.get(0).get("classifications")))
        .containsExactly(
            "missing_send_plan",
            "missing_provider_plan",
            "missing_in_app_execution_plan",
            "in_app_execution_plan_blocked",
            "missing_listener_auto_execution_invocation_plan");
    assertThat(stringList(matrix.get(1).get("classifications")))
        .containsExactly("ready_for_result_adapter_validation");
    assertThat(matrix)
        .allSatisfy(
            decision ->
                assertThat(decision)
                    .containsEntry("classificationExecuted", false)
                    .containsEntry("decisionExecuted", false)
                    .containsEntry("rabbitAckExecuted", false)
                    .containsEntry("rabbitNackExecuted", false));
  }

  private Map<String, Object> classificationAckNackPlan(Map<String, Object> plan) {
    @SuppressWarnings("unchecked")
    Map<String, Object> contractPlan =
        (Map<String, Object>) plan.get("validatorContractPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> inputAdapterPlan =
        (Map<String, Object>) contractPlan.get("inputAdapterPlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> gatePlan =
        (Map<String, Object>) inputAdapterPlan.get("validatorInvocationGatePlan");
    @SuppressWarnings("unchecked")
    Map<String, Object> ackNackPlan =
        (Map<String, Object>) gatePlan.get("classificationAckNackPlan");
    return ackNackPlan;
  }

  @Test
  void configAndReadmeKeepValidatorGatePropertyNameAligned() throws IOException {
    String propertyName =
        "organization-provisioning-in-app-provider-result-adapter-validator-enabled";
    String envName = "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_VALIDATOR_ENABLED";
    String javaPropertyName =
        "organizationProvisioningInAppProviderResultAdapterValidatorEnabled";

    assertThat(readModuleFile("src/main/resources/application.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/resources/application-local.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/resources/application-prod.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/java/cn/yizuw/magic/backend/config/AppProperties.java"))
        .contains("private boolean " + javaPropertyName)
        .contains("isOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled()")
        .contains("setOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled(");
    assertThat(readModuleFile("README.md"))
        .contains("`" + envName + "`")
        .contains("validatorInvocationGatePlan")
        .contains("不调用 `classify(...)`");
  }

  @Test
  void configAndReadmeKeepBridgeGatePropertyNameAligned() throws IOException {
    String propertyName =
        "organization-provisioning-in-app-provider-result-adapter-bridge-enabled";
    String envName = "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_ENABLED";
    String javaPropertyName =
        "organizationProvisioningInAppProviderResultAdapterBridgeEnabled";

    assertThat(readModuleFile("src/main/resources/application.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/resources/application-local.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/resources/application-prod.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/java/cn/yizuw/magic/backend/config/AppProperties.java"))
        .contains("private boolean " + javaPropertyName)
        .contains("isOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled()")
        .contains("setOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled(");
    assertThat(readModuleFile("README.md"))
        .contains("`" + envName + "`")
        .contains("classificationBridgeGatePlan")
        .contains("classifyDryRun(...)")
        .contains("不改变 RabbitMQ");
  }

  @Test
  void configAndReadmeKeepBridgeDecisionDryRunGatePropertyNameAligned() throws IOException {
    String propertyName =
        "organization-provisioning-in-app-provider-result-adapter-bridge-decision-dry-run-enabled";
    String envName =
        "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_ENABLED";
    String javaPropertyName =
        "organizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled";

    assertThat(readModuleFile("src/main/resources/application.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/resources/application-local.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/resources/application-prod.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/java/cn/yizuw/magic/backend/config/AppProperties.java"))
        .contains("private boolean " + javaPropertyName)
        .contains(
            "isOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled()")
        .contains(
            "setOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled(");
    assertThat(readModuleFile("README.md"))
        .contains("`" + envName + "`")
        .contains("bridgeDecisionDryRunInvocationGatePlan")
        .contains("不执行组合 dry-run");
  }

  @Test
  void configAndReadmeKeepDecisionOutputObservationLoggingGatePropertyNameAligned()
      throws IOException {
    String propertyName =
        "organization-provisioning-in-app-provider-result-adapter-bridge-decision-dry-run-observation-log-enabled";
    String envName =
        "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_OBSERVATION_LOG_ENABLED";
    String javaPropertyName =
        "organizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled";

    assertThat(readModuleFile("src/main/resources/application.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/resources/application-local.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/resources/application-prod.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/java/cn/yizuw/magic/backend/config/AppProperties.java"))
        .contains("private boolean " + javaPropertyName)
        .contains(
            "isOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled()")
        .contains(
            "setOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled(");
    assertThat(readModuleFile("README.md"))
        .contains("`" + envName + "`")
        .contains("decisionOutputObservationLoggingGatePlan")
        .contains("不执行 observation logging");
  }

  @Test
  void configAndReadmeKeepBridgeReturnThrowGatePropertyNameAligned() throws IOException {
    String propertyName =
        "organization-provisioning-in-app-provider-result-adapter-bridge-return-throw-enabled";
    String envName =
        "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_RETURN_THROW_ENABLED";
    String javaPropertyName =
        "organizationProvisioningInAppProviderResultAdapterBridgeReturnThrowEnabled";

    assertThat(readModuleFile("src/main/resources/application.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/resources/application-local.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/resources/application-prod.yml"))
        .contains(propertyName + ": ${" + envName + ":false}");
    assertThat(readModuleFile("src/main/java/cn/yizuw/magic/backend/config/AppProperties.java"))
        .contains("private boolean " + javaPropertyName)
        .contains(
            "isOrganizationProvisioningInAppProviderResultAdapterBridgeReturnThrowEnabled()")
        .contains(
            "setOrganizationProvisioningInAppProviderResultAdapterBridgeReturnThrowEnabled(");
    assertThat(readModuleFile("README.md"))
        .contains("`" + envName + "`")
        .contains("bridgeReturnThrowPolicyGatePlan")
        .contains("不改变当前 listener return/throw");
  }

  private void assertAckNackAlignment(
      Map<String, Object> contractPlan,
      String expectedClassification,
      String expectedScenario,
      String expectedNackDecision) {
    assertThat(contractPlan).containsEntry("ackNackAlignmentExecuted", false);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) contractPlan.get("ackNackAlignmentMatrix");
    assertThat(matrix)
        .anySatisfy(
            alignment ->
                assertThat(alignment)
                    .containsEntry("classification", expectedClassification)
                    .containsEntry("ackNackScenario", expectedScenario)
                    .containsEntry("nackDecision", expectedNackDecision)
                    .containsEntry("alignmentExecuted", false)
                    .containsEntry("classificationExecuted", false)
                    .containsEntry("rabbitAckExecuted", false)
                    .containsEntry("rabbitNackExecuted", false));
  }

  private void assertClassificationReturnThrowBoundary(
      Map<String, Object> contractPlan,
      String expectedClassification,
      String expectedScenario,
      String expectedAckDecision,
      String expectedNackDecision) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) contractPlan.get("ackNackAlignmentMatrix");
    assertThat(matrix)
        .anySatisfy(
            alignment ->
                assertThat(alignment)
                    .containsEntry("classification", expectedClassification)
                    .containsEntry("ackNackScenario", expectedScenario)
                    .containsEntry("ackDecision", expectedAckDecision)
                    .containsEntry("nackDecision", expectedNackDecision)
                    .containsEntry("alignmentExecuted", false)
                    .containsEntry("classificationExecuted", false)
                    .containsEntry("rabbitAckExecuted", false)
                    .containsEntry("rabbitNackExecuted", false));
  }

  private List<String> rowStringValues(List<Map<String, Object>> rows, String key) {
    return rows.stream().map(row -> String.valueOf(row.get(key))).toList();
  }

  @SuppressWarnings("unchecked")
  private List<String> stringList(Object value) {
    return (List<String>) value;
  }

  @SuppressWarnings("unchecked")
  private List<List<String>> stringPathList(Object value) {
    return (List<List<String>>) value;
  }

  private String readModuleFile(String relativePath) throws IOException {
    Path modulePath = Path.of(relativePath);
    Path workspacePath = Path.of("apps", "backend-springboot").resolve(modulePath);
    Path sourcePath = Files.exists(modulePath) ? modulePath : workspacePath;
    return Files.readString(sourcePath);
  }
}

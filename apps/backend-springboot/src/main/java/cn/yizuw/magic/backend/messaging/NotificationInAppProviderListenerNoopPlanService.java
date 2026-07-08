package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 后置 in_app provider listener no-op 接入预案；只生成 dry-run，不修改 RabbitMQ listener。 */
@Service
public class NotificationInAppProviderListenerNoopPlanService {

  private static final String ACK_KEEP_CURRENT_LISTENER_POLICY =
      "keep_current_listener_policy";
  private static final String NACK_KEEP_CURRENT_LISTENER_THROW_POLICY =
      "keep_current_listener_throw_policy";
  private static final String ACK_NO_ACK_UNTIL_REAL_ADAPTER_POLICY_BATCH =
      "no_ack_until_real_adapter_policy_batch";
  private static final String NACK_THROW_FOR_RETRY_OR_DLQ_UNTIL_REAL_POLICY_BATCH =
      "throw_for_retry_or_dlq_until_real_policy_batch";
  private static final String ACK_DEFER_UNTIL_MANUAL_EXECUTION_VERIFIED =
      "defer_ack_until_manual_execution_result_is_verified";
  private static final String NACK_NOT_APPLICABLE_UNTIL_REAL_ADAPTER_POLICY_BATCH =
      "not_applicable_until_real_adapter_policy_batch";
  private static final String SCENARIO_ADAPTER_PLAN_BLOCKED =
      "adapter_plan_blocked";
  private static final String SCENARIO_ADAPTER_BLOCKED_BEFORE_VALIDATION =
      "adapter_blocked_before_validation";
  private static final String SCENARIO_NOOP_GATE_DISABLED =
      "noop_gate_disabled";
  private static final String SCENARIO_NOOP_BRANCH_ALLOWED =
      "noop_branch_allowed";
  private static final String SCENARIO_FUTURE_VALIDATION_BLOCKED =
      "future_validation_blocked";
  private static final String SCENARIO_FUTURE_VALIDATION_READY =
      "future_validation_ready";
  private static final String CLASSIFICATION_MISSING_SEND_PLAN = "missing_send_plan";
  private static final String CLASSIFICATION_MISSING_PROVIDER_PLAN =
      "missing_provider_plan";
  private static final String CLASSIFICATION_MISSING_IN_APP_EXECUTION_PLAN =
      "missing_in_app_execution_plan";
  private static final String CLASSIFICATION_IN_APP_EXECUTION_PLAN_BLOCKED =
      "in_app_execution_plan_blocked";
  private static final String CLASSIFICATION_MISSING_LISTENER_INVOCATION_PLAN =
      "missing_listener_auto_execution_invocation_plan";
  private static final String CLASSIFICATION_READY_FOR_RESULT_ADAPTER =
      "ready_for_result_adapter_validation";
  private static final String PLAN_STATUS_BLOCKED = "blocked";
  private static final String PLAN_STATUS_READY_FOR_LISTENER_NOOP_DRY_RUN =
      "ready_for_listener_noop_dry_run";
  private static final String PLAN_STATUS_READY_FOR_VALIDATOR_CONTRACT_DRY_RUN =
      "ready_for_validator_contract_dry_run";
  private static final String VALIDATION_STATUS_BLOCKED = "blocked";
  private static final String VALIDATION_STATUS_READY = "ready";
  private static final String SAMPLE_MISSING_SEND_PLAN =
      "missing_send_plan_sample";
  private static final String SAMPLE_MISSING_PROVIDER_PLAN =
      "missing_provider_plan_sample";
  private static final String SAMPLE_MISSING_IN_APP_EXECUTION_PLAN =
      "missing_in_app_execution_plan_sample";
  private static final String SAMPLE_IN_APP_EXECUTION_PLAN_BLOCKED =
      "in_app_execution_plan_blocked_sample";
  private static final String SAMPLE_MISSING_LISTENER_INVOCATION_PLAN =
      "missing_listener_auto_execution_invocation_plan_sample";
  private static final String SAMPLE_READY_FOR_RESULT_ADAPTER =
      "ready_for_result_adapter_validation_sample";
  private static final String NEXT_ACTION_READY_FOR_VALIDATOR_CONTRACT_VERIFICATION =
      "ready_for_future_listener_noop_to_validator_contract_verification";
  private static final String NEXT_ACTION_FIX_NOOP_BLOCKERS_FOR_CONTRACT_VERIFICATION =
      "fix_listener_noop_blockers_before_validator_contract_verification";
  private static final String NEXT_ACTION_READY_FOR_LISTENER_NOOP_BATCH =
      "ready_for_future_listener_noop_branch_batch_but_current_plan_does_not_modify_listener";
  private static final String NEXT_ACTION_FIX_NOOP_BLOCKERS_FOR_LISTENER_INTEGRATION =
      "fix_listener_noop_branch_blockers_before_listener_integration";
  private static final String BLOCKED_REASON_ADAPTER_PLAN_NOT_READY =
      "result adapter dry-run 尚未 ready，不能进入 listener no-op 分支预案";
  private static final String BLOCKED_REASON_NOOP_GATE_DISABLED =
      "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_LISTENER_NOOP_ENABLED 未开启";
  private static final String EXECUTION_BOUNDARY_LISTENER_NOOP_CONTRACT =
      "第 185 批只生成 no-op 到 validator 的参数契约 dry-run，不修改 listener";
  private static final String EXECUTION_BOUNDARY_VALIDATOR_ACK_NACK_ALIGNMENT =
      "第 188 批只输出 validator 分类与 ack/nack 对齐矩阵，不调用 validator，不改变 ack/nack";
  private static final String NOTE_ADAPTER_PLAN_BLOCKED =
      "result adapter dry-run 未 ready 时，不进入 no-op 分支，沿用当前异常路径";
  private static final String NOTE_NOOP_GATE_DISABLED =
      "no-op 开关关闭时，不新增 listener 分支，不改变 RabbitMQ ack/nack";
  private static final String NOTE_NOOP_BRANCH_ALLOWED =
      "允许未来 no-op 分支 dry-run，但当前仍不确认或拒绝 RabbitMQ 消息";
  private static final String NOTE_FUTURE_VALIDATION_BLOCKED =
      "未来 consumer result 校验失败时应进入显式重试/DLQ 策略批次";
  private static final String NOTE_FUTURE_VALIDATION_READY =
      "未来 consumer result 校验通过后，仍需等手动执行结果验证再决定 ack";
  private static final String RETURN_THROW_ADAPTER_BLOCKED =
      "throw_before_classify_until_real_adapter_policy_batch";
  private static final String RETURN_THROW_VALIDATION_BLOCKED =
      "throw_for_retry_or_dlq_until_real_policy_batch";
  private static final String RETURN_THROW_VALIDATION_READY =
      "return_deferred_until_manual_execution_result_is_verified";

  private final AppProperties appProperties;
  private final NotificationInAppProviderConsumerResultValidationPlanService
      consumerResultValidationPlanService;

  public NotificationInAppProviderListenerNoopPlanService(
      AppProperties appProperties,
      NotificationInAppProviderConsumerResultValidationPlanService
          consumerResultValidationPlanService) {
    this.appProperties = appProperties;
    this.consumerResultValidationPlanService = consumerResultValidationPlanService;
  }

  /**
   * 生成共享 notification listener 未来 no-op 分支预案。
   *
   * <p>本方法不读取真实 consumer result，不调用 provider 手动执行入口，不改变 RabbitMQ ack/nack。
   */
  public Map<String, Object> buildPlan(boolean adapterPlanReady) {
    boolean noopEnabled = listenerNoopEnabled();
    boolean allowed = adapterPlanReady && noopEnabled;
    List<Map<String, Object>> ackNackDecisionMatrix =
        ackNackDecisionMatrix(adapterPlanReady, noopEnabled, allowed);
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", "notification.consumer.delegation.in_app_provider_listener_noop");
    plan.put(
        "planStatus",
        allowed ? PLAN_STATUS_READY_FOR_LISTENER_NOOP_DRY_RUN : PLAN_STATUS_BLOCKED);
    plan.put("listenerNoopEnabled", noopEnabled);
    plan.put("adapterPlanReady", adapterPlanReady);
    plan.put("listenerBean", "notificationRoutingRabbitListener");
    plan.put("listenerMethod", "onMessage");
    plan.put("noopBranchAllowed", allowed);
    plan.put("noopBranchRequested", false);
    plan.put("noopBranchExecuted", false);
    plan.put("consumerResultForwardedToValidator", false);
    plan.put("consumerResultInspected", false);
    plan.put("manualExecutionRequested", false);
    plan.put("manualExecutionExecuted", false);
    plan.put("ackDecision", ACK_KEEP_CURRENT_LISTENER_POLICY);
    plan.put("nackDecision", NACK_KEEP_CURRENT_LISTENER_THROW_POLICY);
    plan.put("ackNackDecisionExecuted", false);
    plan.put("ackNackPolicyChanged", false);
    plan.put("ackNackDecisionMatrix", ackNackDecisionMatrix);
    plan.put("validatorContractPlan", validatorContractPlan(allowed));
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("websocketExecuted", false);
    plan.put("pushExecuted", false);
    plan.put("blockedReasons", blockedReasons(adapterPlanReady, noopEnabled));
    plan.put("executionBoundary", EXECUTION_BOUNDARY_LISTENER_NOOP_CONTRACT);
    plan.put("nextAction", nextAction(allowed));
    return plan;
  }

  /** 描述未来 no-op 分支调用 classify(...) 前必须满足的参数契约；当前不传入真实 result。 */
  private Map<String, Object> validatorContractPlan(boolean noopBranchAllowed) {
    Map<String, Object> validationPlan = consumerResultValidationPlanService.buildPlan();
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider_listener_noop.validator_contract");
    plan.put(
        "planStatus",
        noopBranchAllowed
            ? PLAN_STATUS_READY_FOR_VALIDATOR_CONTRACT_DRY_RUN
            : PLAN_STATUS_BLOCKED);
    plan.put("validatorBean", validationPlan.get("validatorBean"));
    plan.put("validatorMethod", "classify");
    plan.put("argumentName", "consumerResult");
    plan.put("argumentType", "Map<String,Object>");
    plan.put("argumentSource", "dedicatedConsumerResult");
    plan.put("argumentSourceAvailable", false);
    plan.put("sourceResultPath", consumerResultValidationPlanService.sourceResultPath());
    plan.put("requiredNestedPaths", validationPlan.get("requiredNestedPaths"));
    plan.put("inputAdapterPlan", validatorInputAdapterPlan(noopBranchAllowed, validationPlan));
    plan.put("expectedReadyClassification", CLASSIFICATION_READY_FOR_RESULT_ADAPTER);
    plan.put(
        "blockedClassifications",
        List.of(
            CLASSIFICATION_MISSING_SEND_PLAN,
            CLASSIFICATION_MISSING_PROVIDER_PLAN,
            CLASSIFICATION_MISSING_IN_APP_EXECUTION_PLAN,
            CLASSIFICATION_IN_APP_EXECUTION_PLAN_BLOCKED,
            CLASSIFICATION_MISSING_LISTENER_INVOCATION_PLAN));
    plan.put("inputSampleMatrix", validatorInputSampleMatrix());
    plan.put("ackNackAlignmentMatrix", validatorAckNackAlignmentMatrix());
    plan.put("ackNackAlignmentExecuted", false);
    plan.put("contractCheckRequested", false);
    plan.put("contractCheckExecuted", false);
    plan.put("consumerResultForwardedToValidator", false);
    plan.put("consumerResultInspected", false);
    plan.put("adapterInvocationAllowed", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("executionBoundary", EXECUTION_BOUNDARY_VALIDATOR_ACK_NACK_ALIGNMENT);
    plan.put("nextAction", validatorContractNextAction(noopBranchAllowed));
    return plan;
  }

  /** 描述未来 listener no-op 分支到 classify(...) 的入参适配；当前不提取真实 result。 */
  private Map<String, Object> validatorInputAdapterPlan(
      boolean noopBranchAllowed, Map<String, Object> validationPlan) {
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider_listener_noop.validator_input_adapter");
    plan.put(
        "planStatus",
        noopBranchAllowed ? "ready_for_validator_input_adapter_dry_run" : PLAN_STATUS_BLOCKED);
    plan.put("sourceObject", "dedicatedConsumerResult");
    plan.put("sourceObjectAvailable", false);
    plan.put("sourceResultPath", consumerResultValidationPlanService.sourceResultPath());
    plan.put("requiredNestedPaths", validationPlan.get("requiredNestedPaths"));
    plan.put("targetValidatorBean", validationPlan.get("validatorBean"));
    plan.put("targetValidatorMethod", "classify");
    plan.put("targetArgumentName", "consumerResult");
    plan.put("targetArgumentType", "Map<String,Object>");
    plan.put("consumerResultExtractionPlan", consumerResultExtractionPlan(noopBranchAllowed));
    plan.put("validatorInvocationGatePlan", validatorInvocationGatePlan(noopBranchAllowed));
    plan.put("adapterRequested", false);
    plan.put("adapterExecuted", false);
    plan.put("consumerResultForwardedToValidator", false);
    plan.put("classificationExecuted", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put(
        "nextAction",
        noopBranchAllowed
            ? "ready_for_future_validator_input_adapter_contract_verification"
            : "fix_listener_noop_blockers_before_validator_input_adapter");
    return plan;
  }

  /** 描述未来真实 result adapter 如何提取 consumerResult；当前不读取专用 consumer 返回值。 */
  private Map<String, Object> consumerResultExtractionPlan(boolean noopBranchAllowed) {
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider_listener_noop.consumer_result_extraction");
    plan.put(
        "planStatus",
        noopBranchAllowed ? "ready_for_consumer_result_extraction_dry_run" : PLAN_STATUS_BLOCKED);
    plan.put("sourceObject", "dedicatedConsumerResult");
    plan.put("sourceObjectType", "OrganizationProvisioningCompletedNotificationConsumeResult");
    plan.put("sourceObjectProvided", false);
    plan.put("adapterBean", "notificationInAppProviderConsumerResultAdapterService");
    plan.put("adapterMethod", "adapt");
    plan.put("targetArgumentName", "consumerResult");
    plan.put("targetArgumentType", "Map<String,Object>");
    plan.put("targetResultPath", consumerResultValidationPlanService.sourceResultPath());
    plan.put("extractionRequested", false);
    plan.put("extractionExecuted", false);
    plan.put("consumerResultConstructed", false);
    plan.put("consumerResultForwardedToValidator", false);
    plan.put("classificationExecuted", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put(
        "failureStrategy",
        noopBranchAllowed
            ? "throw_before_classify_until_real_adapter_policy_batch"
            : "keep_extraction_blocked_until_listener_noop_ready");
    plan.put(
        "nextAction",
        noopBranchAllowed
            ? "ready_for_future_real_consumer_result_extraction_batch"
            : "fix_listener_noop_blockers_before_consumer_result_extraction");
    return plan;
  }

  /** 描述未来 validator 真实调用安全门；当前只展示开关和阻断原因，不调用 classify(...)。 */
  private Map<String, Object> validatorInvocationGatePlan(boolean noopBranchAllowed) {
    boolean validatorGateEnabled =
        appProperties
            .getRabbitMq()
            .isOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled();
    boolean ready = noopBranchAllowed && validatorGateEnabled;
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider_listener_noop.validator_invocation_gate");
    plan.put("planStatus", ready ? "ready_for_validator_invocation_dry_run" : PLAN_STATUS_BLOCKED);
    plan.put("listenerNoopReady", noopBranchAllowed);
    plan.put("validatorGateEnabled", validatorGateEnabled);
    plan.put("validatorInvocationAllowed", ready);
    plan.put("validatorInvocationRequested", false);
    plan.put("validatorInvocationExecuted", false);
    plan.put("consumerResultProvided", false);
    plan.put("consumerResultForwardedToValidator", false);
    plan.put("classificationExecuted", false);
    plan.put("classificationBridgeGatePlan", classificationBridgeGatePlan(ready));
    plan.put("classificationAckNackPlan", classificationAckNackPlan(ready));
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put(
        "blockedReasons",
        validatorInvocationBlockedReasons(noopBranchAllowed, validatorGateEnabled));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_validator_invocation_batch_but_current_plan_does_not_call_classify"
            : "keep_validator_invocation_blocked_until_gate_ready");
    return plan;
  }

  /** 描述未来 listener 调用 adapter->validator bridge 的安全门；当前不调用 bridge。 */
  private Map<String, Object> classificationBridgeGatePlan(boolean validatorInvocationReady) {
    boolean bridgeGateEnabled =
        appProperties
            .getRabbitMq()
            .isOrganizationProvisioningInAppProviderResultAdapterBridgeEnabled();
    boolean ready = validatorInvocationReady && bridgeGateEnabled;
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider_listener_noop.classification_bridge_gate");
    plan.put(
        "planStatus",
        ready ? "ready_for_classification_bridge_dry_run" : PLAN_STATUS_BLOCKED);
    plan.put("validatorInvocationReady", validatorInvocationReady);
    plan.put("bridgeGateEnabled", bridgeGateEnabled);
    plan.put("bridgeBean", "notificationInAppProviderConsumerResultClassificationBridgeService");
    plan.put("bridgeMethod", "classifyDryRun");
    plan.put("bridgeInvocationAllowed", ready);
    plan.put("bridgeInvocationRequested", false);
    plan.put("bridgeInvocationExecuted", false);
    plan.put("consumerResultForwardedToBridge", false);
    plan.put("adapterExecuted", false);
    plan.put("classificationExecuted", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("bridgeOutcomeDecisionMatrix", classificationBridgeOutcomeDecisionMatrix());
    plan.put("bridgeResultObservationPlan", bridgeResultObservationPlan(ready));
    plan.put("bridgeReturnThrowPolicyGatePlan", bridgeReturnThrowPolicyGatePlan(ready));
    plan.put(
        "bridgeDecisionDryRunInvocationGatePlan",
        bridgeDecisionDryRunInvocationGatePlan(ready));
    plan.put(
        "blockedReasons",
        classificationBridgeBlockedReasons(validatorInvocationReady, bridgeGateEnabled));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_classification_bridge_listener_integration_batch"
            : "keep_classification_bridge_blocked_until_validator_gate_ready");
    return plan;
  }

  private List<String> classificationBridgeBlockedReasons(
      boolean validatorInvocationReady, boolean bridgeGateEnabled) {
    List<String> reasons = new ArrayList<>();
    if (!validatorInvocationReady) {
      reasons.add("validator invocation dry-run 尚未 ready，不能规划 classification bridge 调用");
    }
    if (!bridgeGateEnabled) {
      reasons.add(
          "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_ENABLED 未开启");
    }
    return reasons;
  }

  private List<Map<String, Object>> classificationBridgeOutcomeDecisionMatrix() {
    return List.of(
        classificationBridgeOutcomeDecision(
            SCENARIO_ADAPTER_BLOCKED_BEFORE_VALIDATION,
            PLAN_STATUS_BLOCKED,
            RETURN_THROW_ADAPTER_BLOCKED,
            ACK_NO_ACK_UNTIL_REAL_ADAPTER_POLICY_BATCH,
            NACK_THROW_FOR_RETRY_OR_DLQ_UNTIL_REAL_POLICY_BATCH),
        classificationBridgeOutcomeDecision(
            SCENARIO_FUTURE_VALIDATION_BLOCKED,
            PLAN_STATUS_BLOCKED,
            RETURN_THROW_VALIDATION_BLOCKED,
            ACK_NO_ACK_UNTIL_REAL_ADAPTER_POLICY_BATCH,
            NACK_THROW_FOR_RETRY_OR_DLQ_UNTIL_REAL_POLICY_BATCH),
        classificationBridgeOutcomeDecision(
            SCENARIO_FUTURE_VALIDATION_READY,
            VALIDATION_STATUS_READY,
            RETURN_THROW_VALIDATION_READY,
            ACK_DEFER_UNTIL_MANUAL_EXECUTION_VERIFIED,
            NACK_NOT_APPLICABLE_UNTIL_REAL_ADAPTER_POLICY_BATCH));
  }

  private Map<String, Object> classificationBridgeOutcomeDecision(
      String scenario,
      String classificationStatus,
      String returnThrowDecision,
      String ackDecision,
      String nackDecision) {
    Map<String, Object> decision = new LinkedHashMap<>();
    decision.put("scenario", scenario);
    decision.put("classificationStatus", classificationStatus);
    decision.put("futureReturnThrowDecision", returnThrowDecision);
    decision.put("ackDecision", ackDecision);
    decision.put("nackDecision", nackDecision);
    decision.put("bridgeInvocationExecuted", false);
    decision.put("decisionExecuted", false);
    decision.put("rabbitAckExecuted", false);
    decision.put("rabbitNackExecuted", false);
    return decision;
  }

  private Map<String, Object> bridgeResultObservationPlan(boolean bridgeInvocationReady) {
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider_listener_noop.classification_bridge_result_observation");
    plan.put(
        "planStatus",
        bridgeInvocationReady ? "ready_for_bridge_result_observation_dry_run" : PLAN_STATUS_BLOCKED);
    plan.put("bridgeInvocationReady", bridgeInvocationReady);
    plan.put(
        "observationSource",
        "NotificationInAppProviderConsumerResultClassificationBridgeService.classifyDryRun");
    plan.put(
        "observedFields",
        List.of(
            "classificationStatus",
            "futureReturnThrowDecision",
            "ackDecision",
            "nackDecision",
            "adapterPlanStatus",
            "validationClassification",
            "blockedReasons"));
    plan.put("logMessageKey", "notification.in_app_provider.bridge_result_dry_run");
    plan.put("observationRequested", false);
    plan.put("observationExecuted", false);
    plan.put("bridgeResultObserved", false);
    plan.put("logPlanned", bridgeInvocationReady);
    plan.put("logExecuted", false);
    plan.put("databaseWriteExecuted", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("returnThrowPolicyChanged", false);
    plan.put("ackNackPolicyChanged", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put(
        "nextAction",
        bridgeInvocationReady
            ? "ready_for_future_bridge_result_observation_logging_batch"
            : "keep_bridge_result_observation_blocked_until_bridge_gate_ready");
    return plan;
  }

  private Map<String, Object> bridgeReturnThrowPolicyGatePlan(boolean bridgeInvocationReady) {
    boolean policyGateEnabled =
        appProperties
            .getRabbitMq()
            .isOrganizationProvisioningInAppProviderResultAdapterBridgeReturnThrowEnabled();
    boolean ready = bridgeInvocationReady && policyGateEnabled;
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider_listener_noop.classification_bridge_return_throw_policy_gate");
    plan.put(
        "planStatus",
        ready ? "ready_for_bridge_return_throw_policy_dry_run" : PLAN_STATUS_BLOCKED);
    plan.put("bridgeInvocationReady", bridgeInvocationReady);
    plan.put("returnThrowPolicyGateEnabled", policyGateEnabled);
    plan.put("returnThrowPolicyChangeAllowed", ready);
    plan.put("returnThrowPolicyChangeRequested", false);
    plan.put("returnThrowPolicyChanged", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("bridgeResultObserved", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put(
        "blockedReasons",
        bridgeReturnThrowPolicyBlockedReasons(bridgeInvocationReady, policyGateEnabled));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_listener_return_throw_policy_switch_batch"
            : "keep_listener_return_throw_policy_switch_blocked_until_gate_ready");
    return plan;
  }

  private List<String> bridgeReturnThrowPolicyBlockedReasons(
      boolean bridgeInvocationReady, boolean policyGateEnabled) {
    List<String> reasons = new ArrayList<>();
    if (!bridgeInvocationReady) {
      reasons.add("classification bridge dry-run 尚未 ready，不能规划 listener return/throw 切换");
    }
    if (!policyGateEnabled) {
      reasons.add(
          "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_RETURN_THROW_ENABLED 未开启");
    }
    return reasons;
  }

  private Map<String, Object> bridgeDecisionDryRunInvocationGatePlan(
      boolean bridgeInvocationReady) {
    boolean decisionDryRunGateEnabled =
        appProperties
            .getRabbitMq()
            .isOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunEnabled();
    boolean ready = bridgeInvocationReady && decisionDryRunGateEnabled;
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider_listener_noop.bridge_return_throw_decision_dry_run_invocation_gate");
    plan.put(
        "planStatus",
        ready
            ? "ready_for_bridge_return_throw_decision_dry_run_listener_invocation"
            : PLAN_STATUS_BLOCKED);
    plan.put("bridgeInvocationReady", bridgeInvocationReady);
    plan.put("decisionDryRunGateEnabled", decisionDryRunGateEnabled);
    plan.put("decisionDryRunInvocationAllowed", ready);
    plan.put("decisionDryRunInvocationRequested", false);
    plan.put("decisionDryRunInvocationExecuted", false);
    plan.put(
        "decisionDryRunBean", "notificationInAppProviderBridgeReturnThrowDecisionDryRunService");
    plan.put("decisionDryRunMethod", "decideDryRun");
    plan.put("listenerPolicyChanged", false);
    plan.put("decisionApplied", false);
    plan.put("throwRequested", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put(
        "decisionOutputObservationLoggingGatePlan",
        decisionOutputObservationLoggingGatePlan(ready));
    plan.put(
        "blockedReasons",
        bridgeDecisionDryRunInvocationBlockedReasons(
            bridgeInvocationReady, decisionDryRunGateEnabled));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_listener_read_only_decision_dry_run_invocation_batch"
            : "keep_listener_decision_dry_run_invocation_blocked_until_gate_ready");
    return plan;
  }

  private Map<String, Object> decisionOutputObservationLoggingGatePlan(
      boolean decisionDryRunInvocationReady) {
    boolean loggingGateEnabled =
        appProperties
            .getRabbitMq()
            .isOrganizationProvisioningInAppProviderResultAdapterBridgeDecisionDryRunObservationLogEnabled();
    boolean ready = decisionDryRunInvocationReady && loggingGateEnabled;
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider_listener_noop.bridge_return_throw_decision_output_observation_logging_gate");
    plan.put(
        "planStatus",
        ready
            ? "ready_for_bridge_return_throw_decision_output_observation_logging"
            : PLAN_STATUS_BLOCKED);
    plan.put("decisionDryRunInvocationReady", decisionDryRunInvocationReady);
    plan.put("observationLoggingGateEnabled", loggingGateEnabled);
    plan.put("observationLoggingAllowed", ready);
    plan.put("observationPlanField", "decisionOutputObservationPlan");
    plan.put("logMessageKey", "notification.in_app_provider.bridge_return_throw_decision_dry_run");
    plan.put("observationLoggingRequested", false);
    plan.put("observationLoggingExecuted", false);
    plan.put("logExecuted", false);
    plan.put("databaseWriteExecuted", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("decisionApplied", false);
    plan.put("throwRequested", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put(
        "observationLoggingPayloadPlan",
        decisionOutputObservationLoggingPayloadPlan(ready));
    plan.put(
        "blockedReasons",
        decisionOutputObservationLoggingBlockedReasons(
            decisionDryRunInvocationReady, loggingGateEnabled));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_bridge_return_throw_decision_observation_logging_batch"
            : "keep_decision_output_observation_logging_blocked_until_gate_ready");
    return plan;
  }

  private Map<String, Object> decisionOutputObservationLoggingPayloadPlan(
      boolean loggingGateReady) {
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider_listener_noop.bridge_return_throw_decision_output_observation_logging_payload");
    plan.put(
        "planStatus",
        loggingGateReady
            ? "ready_for_bridge_return_throw_decision_output_observation_logging_payload"
            : PLAN_STATUS_BLOCKED);
    plan.put("loggingGateReady", loggingGateReady);
    plan.put("sourcePlanField", "decisionOutputObservationPlan");
    plan.put(
        "payloadFields",
        List.of(
            "eventId",
            "idempotencyKey",
            "bridgeResult.classificationStatus",
            "bridgeResult.futureReturnThrowDecision",
            "policyDecisionPlan.planStatus",
            "policyDecisionPlan.futureListenerDecision",
            "policyDecisionPlan.decisionApplied",
            "blockedReasons",
            "logMessageKey"));
    plan.put("payloadBuildRequested", false);
    plan.put("payloadBuildExecuted", false);
    plan.put("payloadWritten", false);
    plan.put("logExecuted", false);
    plan.put("databaseWriteExecuted", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("decisionApplied", false);
    plan.put("throwRequested", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put(
        "nextAction",
        loggingGateReady
            ? "ready_for_future_bridge_return_throw_decision_observation_payload_logging_batch"
            : "keep_decision_output_observation_logging_payload_blocked_until_gate_ready");
    return plan;
  }

  private List<String> decisionOutputObservationLoggingBlockedReasons(
      boolean decisionDryRunInvocationReady, boolean loggingGateEnabled) {
    List<String> reasons = new ArrayList<>();
    if (!decisionDryRunInvocationReady) {
      reasons.add("decision dry-run listener 调用尚未 ready，不能规划 observation logging");
    }
    if (!loggingGateEnabled) {
      reasons.add(
          "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_OBSERVATION_LOG_ENABLED 未开启");
    }
    return reasons;
  }

  private List<String> bridgeDecisionDryRunInvocationBlockedReasons(
      boolean bridgeInvocationReady, boolean decisionDryRunGateEnabled) {
    List<String> reasons = new ArrayList<>();
    if (!bridgeInvocationReady) {
      reasons.add("classification bridge dry-run 尚未 ready，不能规划 listener 只读 decision dry-run 调用");
    }
    if (!decisionDryRunGateEnabled) {
      reasons.add(
          "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_BRIDGE_DECISION_DRY_RUN_ENABLED 未开启");
    }
    return reasons;
  }

  /** 描述未来 validator 分类结果到 ack/nack 策略的映射；当前不执行分类或 ack/nack。 */
  private Map<String, Object> classificationAckNackPlan(boolean validatorInvocationReady) {
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider_listener_noop.classification_ack_nack");
    plan.put(
        "planStatus",
        validatorInvocationReady ? "ready_for_classification_ack_nack_dry_run" : PLAN_STATUS_BLOCKED);
    plan.put("validatorInvocationReady", validatorInvocationReady);
    plan.put("classificationExecuted", false);
    plan.put("ackNackDecisionExecuted", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("decisionMatrix", classificationAckNackDecisionMatrix());
    plan.put(
        "nextAction",
        validatorInvocationReady
            ? "ready_for_future_classification_to_ack_nack_policy_batch"
            : "keep_classification_ack_nack_blocked_until_validator_gate_ready");
    return plan;
  }

  private List<Map<String, Object>> classificationAckNackDecisionMatrix() {
    return List.of(
        classificationAckNackDecision(
            SCENARIO_FUTURE_VALIDATION_BLOCKED,
            List.of(
                CLASSIFICATION_MISSING_SEND_PLAN,
                CLASSIFICATION_MISSING_PROVIDER_PLAN,
                CLASSIFICATION_MISSING_IN_APP_EXECUTION_PLAN,
                CLASSIFICATION_IN_APP_EXECUTION_PLAN_BLOCKED,
                CLASSIFICATION_MISSING_LISTENER_INVOCATION_PLAN),
            ACK_NO_ACK_UNTIL_REAL_ADAPTER_POLICY_BATCH,
            NACK_THROW_FOR_RETRY_OR_DLQ_UNTIL_REAL_POLICY_BATCH),
        classificationAckNackDecision(
            SCENARIO_FUTURE_VALIDATION_READY,
            List.of(CLASSIFICATION_READY_FOR_RESULT_ADAPTER),
            ACK_DEFER_UNTIL_MANUAL_EXECUTION_VERIFIED,
            NACK_NOT_APPLICABLE_UNTIL_REAL_ADAPTER_POLICY_BATCH));
  }

  private Map<String, Object> classificationAckNackDecision(
      String scenario, List<String> classifications, String ackDecision, String nackDecision) {
    Map<String, Object> decision = new LinkedHashMap<>();
    decision.put("scenario", scenario);
    decision.put("classifications", classifications);
    decision.put("ackDecision", ackDecision);
    decision.put("nackDecision", nackDecision);
    decision.put("classificationExecuted", false);
    decision.put("decisionExecuted", false);
    decision.put("rabbitAckExecuted", false);
    decision.put("rabbitNackExecuted", false);
    return decision;
  }

  private List<String> validatorInvocationBlockedReasons(
      boolean noopBranchAllowed, boolean validatorGateEnabled) {
    List<String> reasons = new ArrayList<>();
    if (!noopBranchAllowed) {
      reasons.add("listener no-op dry-run 尚未 ready，不能规划 validator 调用");
    }
    if (!validatorGateEnabled) {
      reasons.add(
          "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_VALIDATOR_ENABLED 未开启");
    }
    return reasons;
  }

  /** 将未来分类结果和 ack/nack 策略做静态对齐；当前不执行 ack/nack。 */
  private List<Map<String, Object>> validatorAckNackAlignmentMatrix() {
    return List.of(
        validatorAckNackAlignment(
            CLASSIFICATION_MISSING_SEND_PLAN,
            SCENARIO_FUTURE_VALIDATION_BLOCKED,
            ACK_NO_ACK_UNTIL_REAL_ADAPTER_POLICY_BATCH,
            NACK_THROW_FOR_RETRY_OR_DLQ_UNTIL_REAL_POLICY_BATCH),
        validatorAckNackAlignment(
            CLASSIFICATION_MISSING_PROVIDER_PLAN,
            SCENARIO_FUTURE_VALIDATION_BLOCKED,
            ACK_NO_ACK_UNTIL_REAL_ADAPTER_POLICY_BATCH,
            NACK_THROW_FOR_RETRY_OR_DLQ_UNTIL_REAL_POLICY_BATCH),
        validatorAckNackAlignment(
            CLASSIFICATION_MISSING_IN_APP_EXECUTION_PLAN,
            SCENARIO_FUTURE_VALIDATION_BLOCKED,
            ACK_NO_ACK_UNTIL_REAL_ADAPTER_POLICY_BATCH,
            NACK_THROW_FOR_RETRY_OR_DLQ_UNTIL_REAL_POLICY_BATCH),
        validatorAckNackAlignment(
            CLASSIFICATION_IN_APP_EXECUTION_PLAN_BLOCKED,
            SCENARIO_FUTURE_VALIDATION_BLOCKED,
            ACK_NO_ACK_UNTIL_REAL_ADAPTER_POLICY_BATCH,
            NACK_THROW_FOR_RETRY_OR_DLQ_UNTIL_REAL_POLICY_BATCH),
        validatorAckNackAlignment(
            CLASSIFICATION_MISSING_LISTENER_INVOCATION_PLAN,
            SCENARIO_FUTURE_VALIDATION_BLOCKED,
            ACK_NO_ACK_UNTIL_REAL_ADAPTER_POLICY_BATCH,
            NACK_THROW_FOR_RETRY_OR_DLQ_UNTIL_REAL_POLICY_BATCH),
        validatorAckNackAlignment(
            CLASSIFICATION_READY_FOR_RESULT_ADAPTER,
            SCENARIO_FUTURE_VALIDATION_READY,
            ACK_DEFER_UNTIL_MANUAL_EXECUTION_VERIFIED,
            NACK_NOT_APPLICABLE_UNTIL_REAL_ADAPTER_POLICY_BATCH));
  }

  private Map<String, Object> validatorAckNackAlignment(
      String classification,
      String ackNackScenario,
      String ackDecision,
      String nackDecision) {
    Map<String, Object> alignment = new LinkedHashMap<>();
    alignment.put("classification", classification);
    alignment.put("ackNackScenario", ackNackScenario);
    alignment.put("ackDecision", ackDecision);
    alignment.put("nackDecision", nackDecision);
    alignment.put("alignmentExecuted", false);
    alignment.put("classificationExecuted", false);
    alignment.put("rabbitAckExecuted", false);
    alignment.put("rabbitNackExecuted", false);
    return alignment;
  }

  /** 只描述未来 classify(...) 的输入形态和预期分类；不构造或传递真实 consumer result。 */
  private List<Map<String, Object>> validatorInputSampleMatrix() {
    return List.of(
        validatorInputSample(
            SAMPLE_MISSING_SEND_PLAN,
            "consumerResult 缺少 sendPlan",
            List.of("sendPlan"),
            CLASSIFICATION_MISSING_SEND_PLAN,
            VALIDATION_STATUS_BLOCKED),
        validatorInputSample(
            SAMPLE_MISSING_PROVIDER_PLAN,
            "consumerResult.sendPlan 缺少 providerPlan",
            List.of("sendPlan", "providerPlan"),
            CLASSIFICATION_MISSING_PROVIDER_PLAN,
            VALIDATION_STATUS_BLOCKED),
        validatorInputSample(
            SAMPLE_MISSING_IN_APP_EXECUTION_PLAN,
            "consumerResult.sendPlan.providerPlan 缺少 inAppExecutionPlan",
            consumerResultValidationPlanService.sourceResultPath(),
            CLASSIFICATION_MISSING_IN_APP_EXECUTION_PLAN,
            VALIDATION_STATUS_BLOCKED),
        validatorInputSample(
            SAMPLE_IN_APP_EXECUTION_PLAN_BLOCKED,
            "inAppExecutionPlan.planStatus 不是 ready_for_write_plan",
            List.of("sendPlan", "providerPlan", "inAppExecutionPlan", "planStatus"),
            CLASSIFICATION_IN_APP_EXECUTION_PLAN_BLOCKED,
            VALIDATION_STATUS_BLOCKED),
        validatorInputSample(
            SAMPLE_MISSING_LISTENER_INVOCATION_PLAN,
            "listenerAutoExecutionGatePlan.invocationPlan 缺失",
            List.of(
                "sendPlan",
                "providerPlan",
                "inAppExecutionPlan",
                "listenerAutoExecutionGatePlan",
                "invocationPlan"),
            CLASSIFICATION_MISSING_LISTENER_INVOCATION_PLAN,
            VALIDATION_STATUS_BLOCKED),
        validatorInputSample(
            SAMPLE_READY_FOR_RESULT_ADAPTER,
            "consumerResult 结构满足后续 result adapter dry-run 验收",
            List.of(
                "sendPlan",
                "providerPlan",
                "inAppExecutionPlan",
                "listenerAutoExecutionGatePlan",
                "invocationPlan"),
            CLASSIFICATION_READY_FOR_RESULT_ADAPTER,
            VALIDATION_STATUS_READY));
  }

  private Map<String, Object> validatorInputSample(
      String sampleName,
      String shapeDescription,
      List<String> expectedPath,
      String expectedClassification,
      String expectedStatus) {
    Map<String, Object> sample = new LinkedHashMap<>();
    sample.put("sampleName", sampleName);
    sample.put("shapeDescription", shapeDescription);
    sample.put("expectedPath", expectedPath);
    sample.put("expectedClassification", expectedClassification);
    sample.put("expectedStatus", expectedStatus);
    sample.put("samplePayloadProvided", false);
    sample.put("classificationExecuted", false);
    sample.put("consumerResultForwardedToValidator", false);
    sample.put("adapterInvocationAllowed", false);
    sample.put("manualExecutionAllowed", false);
    sample.put("rabbitAckExecuted", false);
    sample.put("rabbitNackExecuted", false);
    return sample;
  }

  private String validatorContractNextAction(boolean noopBranchAllowed) {
    if (noopBranchAllowed) {
      return NEXT_ACTION_READY_FOR_VALIDATOR_CONTRACT_VERIFICATION;
    }
    return NEXT_ACTION_FIX_NOOP_BLOCKERS_FOR_CONTRACT_VERIFICATION;
  }

  /** no-op 分支 ack/nack 预案只描述未来策略；当前批次不调用 Channel ack/nack。 */
  private List<Map<String, Object>> ackNackDecisionMatrix(
      boolean adapterPlanReady, boolean noopEnabled, boolean allowed) {
    List<Map<String, Object>> matrix = new ArrayList<>();
    matrix.add(
        ackNackDecision(
            SCENARIO_ADAPTER_PLAN_BLOCKED,
            !adapterPlanReady,
            ACK_KEEP_CURRENT_LISTENER_POLICY,
            NACK_KEEP_CURRENT_LISTENER_THROW_POLICY,
            NOTE_ADAPTER_PLAN_BLOCKED));
    matrix.add(
        ackNackDecision(
            SCENARIO_NOOP_GATE_DISABLED,
            adapterPlanReady && !noopEnabled,
            ACK_KEEP_CURRENT_LISTENER_POLICY,
            NACK_KEEP_CURRENT_LISTENER_THROW_POLICY,
            NOTE_NOOP_GATE_DISABLED));
    matrix.add(
        ackNackDecision(
            SCENARIO_NOOP_BRANCH_ALLOWED,
            allowed,
            ACK_KEEP_CURRENT_LISTENER_POLICY,
            NACK_KEEP_CURRENT_LISTENER_THROW_POLICY,
            NOTE_NOOP_BRANCH_ALLOWED));
    matrix.add(
        ackNackDecision(
            SCENARIO_FUTURE_VALIDATION_BLOCKED,
            false,
            ACK_NO_ACK_UNTIL_REAL_ADAPTER_POLICY_BATCH,
            NACK_THROW_FOR_RETRY_OR_DLQ_UNTIL_REAL_POLICY_BATCH,
            NOTE_FUTURE_VALIDATION_BLOCKED));
    matrix.add(
        ackNackDecision(
            SCENARIO_FUTURE_VALIDATION_READY,
            false,
            ACK_DEFER_UNTIL_MANUAL_EXECUTION_VERIFIED,
            NACK_NOT_APPLICABLE_UNTIL_REAL_ADAPTER_POLICY_BATCH,
            NOTE_FUTURE_VALIDATION_READY));
    return matrix;
  }

  private Map<String, Object> ackNackDecision(
      String scenario, boolean matched, String ackDecision, String nackDecision, String note) {
    Map<String, Object> decision = new LinkedHashMap<>();
    decision.put("scenario", scenario);
    decision.put("matched", matched);
    decision.put("ackDecision", ackDecision);
    decision.put("nackDecision", nackDecision);
    decision.put("decisionExecuted", false);
    decision.put("rabbitAckExecuted", false);
    decision.put("rabbitNackExecuted", false);
    decision.put("note", note);
    return decision;
  }

  private List<String> blockedReasons(boolean adapterPlanReady, boolean noopEnabled) {
    List<String> reasons = new ArrayList<>();
    if (!adapterPlanReady) {
      reasons.add(BLOCKED_REASON_ADAPTER_PLAN_NOT_READY);
    }
    if (!noopEnabled) {
      reasons.add(BLOCKED_REASON_NOOP_GATE_DISABLED);
    }
    return reasons;
  }

  private String nextAction(boolean allowed) {
    if (allowed) {
      return NEXT_ACTION_READY_FOR_LISTENER_NOOP_BATCH;
    }
    return NEXT_ACTION_FIX_NOOP_BLOCKERS_FOR_LISTENER_INTEGRATION;
  }

  private boolean listenerNoopEnabled() {
    return appProperties
        .getRabbitMq()
        .isOrganizationProvisioningInAppProviderResultAdapterListenerNoopEnabled();
  }
}

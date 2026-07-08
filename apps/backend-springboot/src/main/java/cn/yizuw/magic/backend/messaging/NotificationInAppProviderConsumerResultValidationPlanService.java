package cn.yizuw.magic.backend.messaging;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 组织开通 notification consumer result 到 in_app provider 的校验预案；只生成 dry-run。 */
@Service
public class NotificationInAppProviderConsumerResultValidationPlanService {

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
  private static final String IN_APP_EXECUTION_PLAN_READY_STATUS = "ready_for_write_plan";
  private static final String CLASSIFICATION_STATUS_BLOCKED = "blocked";
  private static final String CLASSIFICATION_STATUS_READY = "ready";

  /**
   * 生成 consumer result 路径校验和错误分类预案。
   *
   * <p>本方法不读取真实 consumer result，不判断真实 ack/nack，不调用任何 provider。
   */
  public Map<String, Object> buildPlan() {
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", "notification.consumer.delegation.in_app_provider_result_validation");
    plan.put("planStatus", "classification_dry_run");
    plan.put("validatorBean", "notificationInAppProviderConsumerResultValidationPlanService");
    plan.put("consumerResultRequired", true);
    plan.put("consumerResultProvided", false);
    plan.put("consumerResultInspected", false);
    plan.put("validationExecuted", false);
    plan.put("sourceResultPath", sourceResultPath());
    plan.put("requiredNestedPaths", requiredNestedPaths());
    plan.put("blockedStatusPath", blockedStatusPath());
    plan.put("invocationPlanPath", invocationPlanPath());
    plan.put("errorClassifications", errorClassifications());
    plan.put(
        "executionBoundary",
        "第 180 批只提炼 consumer result 校验预案 service，不读取真实 result");
    plan.put("nextAction", "classify_real_consumer_result_before_result_adapter_executes");
    return plan;
  }

  /**
   * 对内存中的 consumer result 样例做纯分类。
   *
   * <p>本方法只检查 Map 结构，不读取 RabbitMQ 消息，不写数据库，不调用 provider。
   */
  public Map<String, Object> classify(Map<String, Object> consumerResult) {
    Map<String, Object> result = new LinkedHashMap<>();
    Map<String, Object> sendPlan = mapValue(valueAt(consumerResult, List.of("sendPlan")));
    if (sendPlan.isEmpty()) {
      return classificationResult(CLASSIFICATION_MISSING_SEND_PLAN, List.of("sendPlan"));
    }
    Map<String, Object> providerPlan =
        mapValue(valueAt(consumerResult, List.of("sendPlan", "providerPlan")));
    if (providerPlan.isEmpty()) {
      return classificationResult(
          CLASSIFICATION_MISSING_PROVIDER_PLAN, List.of("sendPlan", "providerPlan"));
    }
    Map<String, Object> inAppExecutionPlan =
        mapValue(valueAt(consumerResult, sourceResultPath()));
    if (inAppExecutionPlan.isEmpty()) {
      return classificationResult(CLASSIFICATION_MISSING_IN_APP_EXECUTION_PLAN, sourceResultPath());
    }
    if (!IN_APP_EXECUTION_PLAN_READY_STATUS.equals(
        stringValue(inAppExecutionPlan.get("planStatus")))) {
      return classificationResult(CLASSIFICATION_IN_APP_EXECUTION_PLAN_BLOCKED, blockedStatusPath());
    }
    Object invocationPlan = valueAt(consumerResult, invocationPlanPath());
    if (!(invocationPlan instanceof Map<?, ?>)) {
      return classificationResult(
          CLASSIFICATION_MISSING_LISTENER_INVOCATION_PLAN, invocationPlanPath());
    }
    result.put("classificationCode", CLASSIFICATION_READY_FOR_RESULT_ADAPTER);
    result.put("classificationStatus", CLASSIFICATION_STATUS_READY);
    result.put("classificationPassed", true);
    result.put("adapterInvocationAllowed", false);
    result.put("manualExecutionAllowed", false);
    result.put("consumerResultInspected", true);
    result.put("validationExecuted", true);
    result.put("reason", "consumer result structure is ready for future adapter dry-run");
    result.put("sourceResultPath", sourceResultPath());
    result.put("rabbitAckDecision", "keep_current_listener_policy");
    return result;
  }

  public List<String> sourceResultPath() {
    return List.of("sendPlan", "providerPlan", "inAppExecutionPlan");
  }

  private List<String> blockedStatusPath() {
    return List.of("sendPlan", "providerPlan", "inAppExecutionPlan", "planStatus");
  }

  private List<String> invocationPlanPath() {
    return List.of(
        "sendPlan",
        "providerPlan",
        "inAppExecutionPlan",
        "listenerAutoExecutionGatePlan",
        "invocationPlan");
  }

  private List<List<String>> requiredNestedPaths() {
    return List.of(
        List.of("sendPlan"),
        List.of("sendPlan", "providerPlan"),
        List.of("sendPlan", "providerPlan", "inAppExecutionPlan"),
        List.of("sendPlan", "providerPlan", "inAppExecutionPlan", "listenerAutoExecutionGatePlan"),
        invocationPlanPath());
  }

  private List<Map<String, Object>> errorClassifications() {
    return List.of(
        errorClassification(
            CLASSIFICATION_MISSING_SEND_PLAN,
            "sendPlan 缺失，不能提取 inAppExecutionPlan",
            List.of("sendPlan")),
        errorClassification(
            CLASSIFICATION_MISSING_PROVIDER_PLAN,
            "sendPlan.providerPlan 缺失，不能提取 inAppExecutionPlan",
            List.of("sendPlan", "providerPlan")),
        errorClassification(
            CLASSIFICATION_MISSING_IN_APP_EXECUTION_PLAN,
            "sendPlan.providerPlan.inAppExecutionPlan 缺失，不能调用 in_app provider",
            List.of("sendPlan", "providerPlan", "inAppExecutionPlan")),
        errorClassification(
            CLASSIFICATION_IN_APP_EXECUTION_PLAN_BLOCKED,
            "inAppExecutionPlan.planStatus 不是 ready_for_write_plan",
            blockedStatusPath()),
        errorClassification(
            CLASSIFICATION_MISSING_LISTENER_INVOCATION_PLAN,
            "listenerAutoExecutionGatePlan.invocationPlan 缺失，不能串联手动执行 service",
            invocationPlanPath()));
  }

  private Map<String, Object> errorClassification(
      String code, String reason, List<String> path) {
    Map<String, Object> classification = new LinkedHashMap<>();
    classification.put("code", code);
    classification.put("reason", reason);
    classification.put("path", path);
    classification.put("adapterInvocationAllowed", false);
    classification.put("manualExecutionAllowed", false);
    classification.put("rabbitAckDecision", "throw_to_retry_or_dlq_until_real_policy_batch");
    return classification;
  }

  private Map<String, Object> classificationResult(String code, List<String> path) {
    Map<String, Object> classification = errorClassifications().stream()
        .filter(candidate -> code.equals(candidate.get("code")))
        .findFirst()
        .orElse(errorClassification(code, "consumer result 结构不满足后置 adapter 要求", path));
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("classificationCode", code);
    result.put("classificationStatus", CLASSIFICATION_STATUS_BLOCKED);
    result.put("classificationPassed", false);
    result.put("path", classification.get("path"));
    result.put("reason", classification.get("reason"));
    result.put("adapterInvocationAllowed", false);
    result.put("manualExecutionAllowed", false);
    result.put("consumerResultInspected", true);
    result.put("validationExecuted", true);
    result.put("rabbitAckDecision", classification.get("rabbitAckDecision"));
    return result;
  }

  private Map<String, Object> mapValue(Object value) {
    if (value instanceof Map<?, ?> map) {
      Map<String, Object> result = new LinkedHashMap<>();
      for (Map.Entry<?, ?> entry : map.entrySet()) {
        result.put(String.valueOf(entry.getKey()), entry.getValue());
      }
      return result;
    }
    return Map.of();
  }

  private Object valueAt(Map<String, Object> source, List<String> path) {
    Object current = source;
    for (String segment : path) {
      if (!(current instanceof Map<?, ?> map)) {
        return null;
      }
      current = map.get(segment);
    }
    return current;
  }

  private String stringValue(Object value) {
    if (value == null) {
      return "";
    }
    String text = String.valueOf(value);
    return StringUtils.hasText(text) ? text : "";
  }
}

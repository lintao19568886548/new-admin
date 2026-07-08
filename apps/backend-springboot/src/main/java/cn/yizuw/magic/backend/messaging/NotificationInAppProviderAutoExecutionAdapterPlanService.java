package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 共享 notification listener 委托后串联 in_app provider 的 adapter 预案；只生成 dry-run。 */
@Service
public class NotificationInAppProviderAutoExecutionAdapterPlanService {

  private static final String ORGANIZATION_ROUTE =
      NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED;
  private static final String ORGANIZATION_REQUEST_TYPE =
      "OrganizationProvisioningCompletedNotificationConsumeRequest";

  private final AppProperties appProperties;
  private final NotificationInAppProviderConsumerResultValidationPlanService
      consumerResultValidationPlanService;
  private final NotificationInAppProviderListenerNoopPlanService listenerNoopPlanService;

  public NotificationInAppProviderAutoExecutionAdapterPlanService(
      AppProperties appProperties,
      NotificationInAppProviderConsumerResultValidationPlanService
          consumerResultValidationPlanService,
      NotificationInAppProviderListenerNoopPlanService listenerNoopPlanService) {
    this.appProperties = appProperties;
    this.consumerResultValidationPlanService = consumerResultValidationPlanService;
    this.listenerNoopPlanService = listenerNoopPlanService;
  }

  /**
   * 生成未来 listener 在专用 consumer 成功后串联 in_app provider 的 dry-run 计划。
   *
   * <p>本方法不读取专用 consumer 真实结果，不调用手动执行 service，不改变 RabbitMQ ack/nack 行为。
   */
  public Map<String, Object> buildPlan(
      Map<String, Object> routingPlan,
      Map<String, Object> requestValidationPlan,
      boolean delegationAllowed,
      List<String> delegationFailedChecks) {
    String route = stringValue(first(requestValidationPlan, routingPlan, "route"));
    String requestType = stringValue(requestValidationPlan.get("requestType"));
    boolean routeSupported = ORGANIZATION_ROUTE.equals(route);
    boolean requestTypeMatched =
        !routeSupported || ORGANIZATION_REQUEST_TYPE.equals(requestType);
    boolean providerCallEnabled = booleanValue(requestValidationPlan.get("providerCallEnabled"));
    boolean providerCallBlocked = booleanValue(requestValidationPlan.get("providerCallBlocked"));
    boolean resultAdapterEnabled = resultAdapterEnabled();
    boolean providerCallSafe = !providerCallEnabled && !providerCallBlocked;
    List<Map<String, Object>> readinessMatrix =
        readinessMatrix(
            routeSupported,
            requestTypeMatched,
            delegationAllowed,
            resultAdapterEnabled,
            providerCallSafe,
            delegationFailedChecks);
    List<String> readinessFailedChecks = failedReadinessChecks(readinessMatrix);
    List<String> blockedReasons =
        blockedReasons(
            routeSupported,
            requestTypeMatched,
            delegationAllowed,
            providerCallEnabled,
            providerCallBlocked,
            readinessFailedChecks,
            delegationFailedChecks);
    boolean ready = readinessFailedChecks.isEmpty() && blockedReasons.isEmpty();

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", "notification.consumer.delegation.in_app_provider_adapter");
    plan.put("planStatus", ready ? "ready_for_result_adapter_dry_run" : "blocked");
    plan.put("route", route);
    plan.put("routeSupported", routeSupported);
    plan.put("requestType", requestType);
    plan.put("requestTypeMatched", requestTypeMatched);
    plan.put("delegationAllowed", delegationAllowed);
    plan.put("delegationFailedChecks", safeList(delegationFailedChecks));
    plan.put("resultAdapterEnabled", resultAdapterEnabled);
    plan.put("providerCallEnabled", providerCallEnabled);
    plan.put("providerCallBlocked", providerCallBlocked);
    plan.put(
        "adapterBean", "organizationProvisioningCompletedInAppProviderAutoExecutionAdapter");
    plan.put("sourceConsumerBean", "organizationProvisioningCompletedNotificationConsumerService");
    plan.put("sourceConsumerMethod", "consume");
    plan.put("sourceResultType", "OrganizationProvisioningCompletedNotificationConsumeResult");
    plan.put("sourceResultPath", sourceResultPath());
    plan.put(
        "manualExecutionBean",
        "organizationProvisioningCompletedInAppProviderManualExecutionService");
    plan.put("manualExecutionMethod", "execute");
    plan.put(
        "manualExecutionArgumentSource",
        "consumerResult.sendPlan.providerPlan.inAppExecutionPlan");
    plan.put("adapterInvocationAllowed", ready);
    plan.put("adapterInvocationRequested", false);
    plan.put("adapterInvocationExecuted", false);
    plan.put("resultAdapterInvocationRequested", false);
    plan.put("resultAdapterInvocationExecuted", false);
    plan.put("consumerResultInspected", false);
    plan.put("manualExecutionRequested", false);
    plan.put("manualExecutionExecuted", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("websocketExecuted", false);
    plan.put("pushExecuted", false);
    plan.put("executionOrder", executionOrder());
    plan.put("ackStrategy", "keep_current_delegation_ack_until_real_adapter_batch");
    plan.put("nackStrategy", "keep_current_delegation_throw_on_non_ackable_result");
    plan.put(
        "executionBoundary",
        "第 179 批只生成 result adapter 安全门和 consumer result 分类预案，不执行 adapter");
    plan.put("readinessMatrix", readinessMatrix);
    plan.put("readinessFailedChecks", readinessFailedChecks);
    plan.put("consumerResultValidationPlan", consumerResultValidationPlanService.buildPlan());
    plan.put("listenerNoopIntegrationPlan", listenerNoopPlanService.buildPlan(ready));
    plan.put("expectedConsumerResultFields", expectedConsumerResultFields());
    plan.put("expectedInAppExecutionPlanFields", expectedInAppExecutionPlanFields());
    plan.put("blockedReasons", blockedReasons);
    plan.put("nextAction", nextAction(ready));
    return plan;
  }

  private List<String> blockedReasons(
      boolean routeSupported,
      boolean requestTypeMatched,
      boolean delegationAllowed,
      boolean providerCallEnabled,
      boolean providerCallBlocked,
      List<String> readinessFailedChecks,
      List<String> delegationFailedChecks) {
    List<String> reasons = new ArrayList<>();
    if (!routeSupported) {
      reasons.add("route 不是组织开通完成 notification，不能规划 in_app provider adapter");
    }
    if (!requestTypeMatched) {
      reasons.add("requestType 与组织开通完成 notification consumer 不匹配");
    }
    if (!delegationAllowed) {
      reasons.add("专用 consumer 委托尚未允许，不能规划后置 in_app provider adapter");
    }
    if (delegationFailedChecks != null && !delegationFailedChecks.isEmpty()) {
      reasons.add("专用 consumer 委托安全门仍有失败项: " + delegationFailedChecks);
    }
    if (providerCallEnabled || providerCallBlocked) {
      reasons.add("上游 providerCall 开关未保持关闭，不能规划后置 in_app provider adapter");
    }
    if (!readinessFailedChecks.isEmpty()) {
      reasons.add("result adapter 安全门仍有失败项: " + readinessFailedChecks);
    }
    return reasons.stream().filter(StringUtils::hasText).distinct().toList();
  }

  /** 真实 result adapter 前的安全门矩阵；本批只展示条件，不执行后置 adapter。 */
  private List<Map<String, Object>> readinessMatrix(
      boolean routeSupported,
      boolean requestTypeMatched,
      boolean delegationAllowed,
      boolean resultAdapterEnabled,
      boolean providerCallSafe,
      List<String> delegationFailedChecks) {
    List<Map<String, Object>> matrix = new ArrayList<>();
    matrix.add(
        readinessCheck(
            "route_supported",
            routeSupported,
            routeSupported
                ? "route 是组织开通完成 notification"
                : "route 不是组织开通完成 notification"));
    matrix.add(
        readinessCheck(
            "request_type_matched",
            requestTypeMatched,
            requestTypeMatched
                ? "请求类型匹配组织开通完成 consumer"
                : "请求类型不匹配组织开通完成 consumer"));
    matrix.add(
        readinessCheck(
            "delegation_allowed",
            delegationAllowed,
            delegationAllowed ? "专用 consumer 委托已允许" : "专用 consumer 委托未允许"));
    matrix.add(
        readinessCheck(
            "delegation_failed_checks_empty",
            delegationFailedChecks == null || delegationFailedChecks.isEmpty(),
            delegationFailedChecks == null || delegationFailedChecks.isEmpty()
                ? "专用 consumer 委托安全门无失败项"
                : "专用 consumer 委托安全门仍有失败项"));
    matrix.add(
        readinessCheck(
            "result_adapter_gate_enabled",
            resultAdapterEnabled,
            resultAdapterEnabled
                ? "result adapter 安全门已开启"
                : "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_RESULT_ADAPTER_ENABLED 未开启"));
    matrix.add(
        readinessCheck(
            "provider_call_disabled",
            providerCallSafe,
            providerCallSafe
                ? "上游 providerCall 开关保持关闭"
                : "上游 providerCall 开关未保持关闭"));
    matrix.add(
        readinessCheck(
            "adapter_side_effect_free",
            true,
            "第 178 批只生成后置 adapter 安全门，不执行 consumer result adapter"));
    return matrix;
  }

  private Map<String, Object> readinessCheck(String name, boolean passed, String note) {
    Map<String, Object> check = new LinkedHashMap<>();
    check.put("name", name);
    check.put("passed", passed);
    check.put("note", note);
    return check;
  }

  private List<String> failedReadinessChecks(List<Map<String, Object>> readinessMatrix) {
    return readinessMatrix.stream()
        .filter(check -> !Boolean.TRUE.equals(check.get("passed")))
        .map(check -> stringValue(check.get("name")))
        .filter(StringUtils::hasText)
        .toList();
  }

  private List<String> sourceResultPath() {
    return consumerResultValidationPlanService.sourceResultPath();
  }

  private List<String> executionOrder() {
    return List.of(
        "delegate_to_dedicated_consumer",
        "inspect_ackable_consumer_result",
        "extract_in_app_execution_plan",
        "validate_listener_auto_execution_invocation_plan",
        "call_manual_execution_service",
        "ack_if_success_or_duplicate");
  }

  private List<String> expectedConsumerResultFields() {
    return List.of(
        "consumed",
        "duplicate",
        "sendPlan",
        "sendPlanGenerated",
        "status",
        "reason");
  }

  private List<String> expectedInAppExecutionPlanFields() {
    return List.of(
        "planStatus",
        "channel",
        "eventId",
        "idempotencyKey",
        "executorPreflightPlan",
        "writePreview",
        "listenerAutoExecutionGatePlan");
  }

  private String nextAction(boolean ready) {
    if (ready) {
      return "ready_for_future_listener_result_adapter_batch_but_current_plan_does_not_execute";
    }
    return "fix_in_app_provider_adapter_plan_blockers_before_listener_result_integration";
  }

  private Object first(
      Map<String, Object> primary, Map<String, Object> fallback, String key) {
    Object value = primary.get(key);
    return value == null ? fallback.get(key) : value;
  }

  private List<String> safeList(List<String> values) {
    if (values == null) {
      return List.of();
    }
    return List.copyOf(values);
  }

  private boolean resultAdapterEnabled() {
    return appProperties
        .getRabbitMq()
        .isOrganizationProvisioningInAppProviderResultAdapterEnabled();
  }

  private boolean booleanValue(Object value) {
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof String text) {
      return "true".equalsIgnoreCase(text.trim()) || "1".equals(text.trim());
    }
    if (value instanceof Number number) {
      return number.intValue() == 1;
    }
    return false;
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

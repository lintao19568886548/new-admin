package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 通用 notification 到专用 consumer 的委托前置计划。 */
@Service
public class NotificationConsumerDelegationPlanService {

  private static final String ORGANIZATION_ROUTE =
      NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED;
  private static final String ORGANIZATION_CONSUMER_BEAN =
      "organizationProvisioningCompletedNotificationConsumerService";
  private static final String ORGANIZATION_REQUEST_TYPE =
      "OrganizationProvisioningCompletedNotificationConsumeRequest";
  private static final String ORGANIZATION_RESULT_TYPE =
      "OrganizationProvisioningCompletedNotificationConsumeResult";

  private final AppProperties appProperties;
  private final NotificationInAppProviderAutoExecutionAdapterPlanService
      inAppProviderAutoExecutionAdapterPlanService;

  public NotificationConsumerDelegationPlanService(
      AppProperties appProperties,
      NotificationInAppProviderAutoExecutionAdapterPlanService
          inAppProviderAutoExecutionAdapterPlanService) {
    this.appProperties = appProperties;
    this.inAppProviderAutoExecutionAdapterPlanService =
        inAppProviderAutoExecutionAdapterPlanService;
  }

  /**
   * 生成专用 consumer 委托前置计划。
   *
   * <p>本方法只预览 request 构造字段、result 字段形态和 listener 委托条件；不执行委托，
   * 不写消费日志，不读写数据库，也不调用短信、企微或站内信 provider。
   */
  public Map<String, Object> buildPlan(
      Map<String, Object> routingPlan,
      Map<String, Object> requestValidationPlan,
      String payload) {
    String route = stringValue(requestValidationPlan.get("route"));
    boolean delegationSupported = supportsDelegation(route);
    boolean requestValidationPassed =
        Boolean.TRUE.equals(requestValidationPlan.get("requestValidationPassed"));
    String requestType = stringValue(requestValidationPlan.get("requestType"));
    boolean requestTypeMatched =
        !delegationSupported || ORGANIZATION_REQUEST_TYPE.equals(requestType);
    boolean delegationEnabled =
        appProperties.getRabbitMq().isNotificationConsumerDelegationEnabled();
    String routeGuard = routeGuard();
    boolean routeGuardMatched = route.equals(routeGuard);
    boolean providerCallEnabled = booleanValue(requestValidationPlan.get("providerCallEnabled"));
    boolean providerCallBlocked = booleanValue(requestValidationPlan.get("providerCallBlocked"));
    boolean providerCallSafe = !providerCallEnabled && !providerCallBlocked;
    boolean delegationAllowed =
        delegationSupported
            && requestValidationPassed
            && requestTypeMatched
            && delegationEnabled
            && routeGuardMatched
            && providerCallSafe;
    List<Map<String, Object>> readinessMatrix =
        delegationReadinessMatrix(
            delegationSupported,
            requestValidationPassed,
            requestTypeMatched,
            delegationEnabled,
            routeGuardMatched,
            providerCallEnabled,
            providerCallBlocked,
            providerCallSafe,
            delegationAllowed);
    List<String> failedChecks = failedReadinessChecks(readinessMatrix);

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", "notification.consumer.delegation.plan");
    plan.put("planStatus", delegationAllowed ? "ready" : "blocked");
    plan.put("route", route);
    plan.put("consumerBean", consumerBean(route));
    plan.put("consumerMethod", "consume");
    plan.put("delegationSupported", delegationSupported);
    plan.put("requestValidationPassed", requestValidationPassed);
    plan.put("requestType", requestType);
    plan.put("requestTypeMatched", requestTypeMatched);
    plan.put("delegationEnabled", delegationEnabled);
    plan.put("routeGuard", routeGuard);
    plan.put("routeGuardMatched", routeGuardMatched);
    plan.put("providerCallEnabled", providerCallEnabled);
    plan.put("providerCallBlocked", providerCallBlocked);
    plan.put("delegationAllowed", delegationAllowed);
    plan.put(
        "consumerInvocationMode",
        delegationAllowed ? "real_delegation_allowed" : "blocked_before_delegation");
    plan.put(
        "ackStrategy",
        delegationAllowed ? "delegate_then_ack_success_or_duplicate" : "throw_to_avoid_ack");
    plan.put("delegationRequested", false);
    plan.put("delegationExecuted", false);
    plan.put("handlerInvocationExecuted", false);
    plan.put("delegationReadinessMatrix", readinessMatrix);
    plan.put("delegationReadinessFailedChecks", failedChecks);
    plan.put(
        "inAppProviderAutoExecutionAdapterPlan",
        inAppProviderAutoExecutionAdapterPlanService.buildPlan(
            routingPlan, requestValidationPlan, delegationAllowed, failedChecks));
    plan.put("nextAction", nextAction(delegationAllowed));
    plan.put("requestPreview", requestPreview(route, routingPlan, requestValidationPlan, payload));
    plan.put("resultPreview", resultPreview(route));
    plan.put(
        "blockedReasons",
        blockedReasons(
            route,
            delegationSupported,
            requestValidationPassed,
            requestTypeMatched,
            delegationEnabled,
            routeGuardMatched,
            providerCallSafe));
    return plan;
  }

  /** 汇总真实委托前必须逐项确认的条件，便于 RabbitMQ 灰度验收时人工核对。 */
  private List<Map<String, Object>> delegationReadinessMatrix(
      boolean delegationSupported,
      boolean requestValidationPassed,
      boolean requestTypeMatched,
      boolean delegationEnabled,
      boolean routeGuardMatched,
      boolean providerCallEnabled,
      boolean providerCallBlocked,
      boolean providerCallSafe,
      boolean delegationAllowed) {
    List<Map<String, Object>> matrix = new ArrayList<>();
    matrix.add(
        readinessCheck(
            "route_supported",
            delegationSupported,
            delegationSupported ? "route 已登记专用 consumer" : "route 未登记专用 consumer"));
    matrix.add(
        readinessCheck(
            "request_validation_passed",
            requestValidationPassed,
            requestValidationPassed ? "headers/payload 校验通过" : "headers/payload 校验未通过"));
    matrix.add(
        readinessCheck(
            "request_type_matched",
            requestTypeMatched,
            requestTypeMatched ? "请求类型匹配专用 consumer" : "请求类型不匹配专用 consumer"));
    matrix.add(
        readinessCheck(
            "delegation_gate_enabled",
            delegationEnabled,
            delegationEnabled
                ? "RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ENABLED 已开启"
                : "RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ENABLED 未开启"));
    matrix.add(
        readinessCheck(
            "route_guard_matched",
            routeGuardMatched,
            routeGuardMatched
                ? "route guard 匹配"
                : "route guard 不匹配，不能委托共享队列消息"));
    matrix.add(
        readinessCheck(
            "provider_call_disabled",
            providerCallSafe,
            providerCallEnabled
                ? "providerCallEnabled=true 已被前置校验阻断"
                : "provider 调用仍保持关闭"));
    matrix.add(
        readinessCheck(
            "plan_side_effect_free",
            true,
            delegationAllowed
                ? "计划生成无副作用，真实委托由 listener 执行"
                : "计划生成无副作用，listener 必须抛错避免 ack"));
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

  private String nextAction(boolean delegationAllowed) {
    if (delegationAllowed) {
      return "delegate_to_dedicated_consumer_and_ack_success_or_duplicate";
    }
    return "fix_blocked_readiness_checks_before_real_delegation";
  }

  private boolean supportsDelegation(String route) {
    return ORGANIZATION_ROUTE.equals(route);
  }

  private String consumerBean(String route) {
    if (supportsDelegation(route)) {
      return ORGANIZATION_CONSUMER_BEAN;
    }
    return "";
  }

  private Map<String, Object> requestPreview(
      String route,
      Map<String, Object> routingPlan,
      Map<String, Object> requestValidationPlan,
      String payload) {
    if (!supportsDelegation(route)) {
      return Map.of();
    }
    Map<String, Object> headers = headers(routingPlan);
    Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("requestType", ORGANIZATION_REQUEST_TYPE);
    preview.put("eventId", eventId(routingPlan, headers));
    preview.put("idempotencyKey", stringValue(headers.get("idempotencyKey")));
    preview.put("messageId", stringValue(routingPlan.get("messageId")));
    preview.put("eventType", stringValue(headers.get("eventType")));
    preview.put("templateKey", stringValue(headers.get("templateKey")));
    preview.put("payloadForwarding", "raw_body_to_consumer_request");
    preview.put("payloadSizeBytes", payloadSizeBytes(payload));
    preview.put("validatedPayloadPreview", payloadPreview(requestValidationPlan));
    return preview;
  }

  private Map<String, Object> resultPreview(String route) {
    if (!supportsDelegation(route)) {
      return Map.of();
    }
    Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("resultType", ORGANIZATION_RESULT_TYPE);
    preview.put("resultGenerated", false);
    preview.put("resultSource", "pending_dedicated_consumer_execution");
    preview.put("expectedFields", expectedResultFields());
    preview.put(
        "statusCandidates",
        List.of("success", "duplicate", "invalid", "failed", "skipped"));
    preview.put(
        "sideEffectsDeferred",
        List.of("event_consume_log", "recipient_plan", "provider_plan"));
    return preview;
  }

  private List<String> expectedResultFields() {
    return List.of(
        "consumed",
        "duplicate",
        "eventId",
        "idempotencyKey",
        "jobId",
        "sendPlan",
        "sendPlanGenerated",
        "reason",
        "status",
        "targetCustomerId",
        "targetDbName");
  }

  private List<String> blockedReasons(
      String route,
      boolean delegationSupported,
      boolean requestValidationPassed,
      boolean requestTypeMatched,
      boolean delegationEnabled,
      boolean routeGuardMatched,
      boolean providerCallSafe) {
    List<String> reasons = new ArrayList<>();
    if (!delegationSupported) {
      reasons.add("route 尚未接入专用 consumer 委托 dry-run: " + route);
    }
    if (!requestValidationPassed) {
      reasons.add("adapter 请求校验未通过，不能进入专用 consumer 委托计划");
    }
    if (!requestTypeMatched) {
      reasons.add("requestType 与组织开通完成 notification consumer 不匹配");
    }
    if (!delegationEnabled) {
      reasons.add("RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ENABLED 未开启");
    }
    if (!routeGuardMatched) {
      reasons.add("route 与 RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ROUTE_GUARD 不匹配");
    }
    if (!providerCallSafe) {
      reasons.add("provider 调用开关未关闭，不能进入专用 consumer 委托计划");
    }
    if (!reasons.isEmpty()) {
      reasons.add("未满足真实委托条件，listener 必须抛错避免 ack");
    }
    return reasons.stream().filter(StringUtils::hasText).distinct().toList();
  }

  private String routeGuard() {
    String configured = appProperties.getRabbitMq().getNotificationConsumerDelegationRouteGuard();
    if (StringUtils.hasText(configured)) {
      return configured.trim();
    }
    return ORGANIZATION_ROUTE;
  }

  private String eventId(Map<String, Object> routingPlan, Map<String, Object> headers) {
    String eventId = stringValue(headers.get("eventId"));
    if (StringUtils.hasText(eventId)) {
      return eventId;
    }
    return stringValue(routingPlan.get("messageId"));
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> headers(Map<String, Object> routingPlan) {
    Object value = routingPlan.get("headers");
    if (value instanceof Map<?, ?> map) {
      return (Map<String, Object>) map;
    }
    return Map.of();
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> payloadPreview(Map<String, Object> requestValidationPlan) {
    Object value = requestValidationPlan.get("payloadPreview");
    if (value instanceof Map<?, ?> map) {
      return (Map<String, Object>) map;
    }
    return Map.of();
  }

  private int payloadSizeBytes(String payload) {
    if (payload == null) {
      return 0;
    }
    return payload.getBytes(StandardCharsets.UTF_8).length;
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

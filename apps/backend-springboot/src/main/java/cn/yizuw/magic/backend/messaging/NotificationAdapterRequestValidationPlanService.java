package cn.yizuw.magic.backend.messaging;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 通用 notification adapter 请求校验计划；当前只 dry-run，不调用专用 consumer。 */
@Service
public class NotificationAdapterRequestValidationPlanService {

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

  /**
   * 生成专用 handler adapter 的请求校验计划。
   *
   * <p>本方法只校验组织开通完成 notification 的 headers、payload 必填字段和 provider 安全门；
   * 不写消费日志，不读写中心库或租户库，也不调用短信、企微或站内信 provider。
   */
  public Map<String, Object> buildPlan(
      Map<String, Object> routingPlan,
      Map<String, Object> adapterPlan,
      String payload) {
    String route = stringValue(adapterPlan.get("route"));
    boolean adapterInvocationAllowed =
        Boolean.TRUE.equals(adapterPlan.get("adapterInvocationAllowed"));
    boolean validationSupported = supportsValidation(route);
    Map<String, Object> headers = headers(routingPlan);
    PayloadValidation payloadValidation = payloadValidation(payload, validationSupported);
    List<String> missingHeaders = missingHeaders(routingPlan, headers);
    boolean eventTypeMatched =
        OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE.equals(
            stringValue(headers.get("eventType")));
    boolean templateKeyMatched =
        OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY.equals(
            stringValue(headers.get("templateKey")));
    boolean validationPassed =
        validationSupported
            && adapterInvocationAllowed
            && missingHeaders.isEmpty()
            && eventTypeMatched
            && templateKeyMatched
            && payloadValidation.passed();

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", "notification.adapter.request.validation");
    plan.put("planStatus", "dry_run");
    plan.put("route", route);
    plan.put("adapterBean", stringValue(adapterPlan.get("adapterBean")));
    plan.put("requestType", stringValue(adapterPlan.get("requestType")));
    plan.put("adapterInvocationAllowed", adapterInvocationAllowed);
    plan.put("validationSupported", validationSupported);
    plan.put("requestValidationPassed", validationPassed);
    plan.put("requestValidationStatus", validationPassed ? "ready" : "blocked");
    plan.put("requestValidationRequested", false);
    plan.put("requestValidationExecuted", false);
    plan.put("handlerInvocationExecuted", false);
    plan.put("missingHeaders", missingHeaders);
    plan.put("eventTypeMatched", eventTypeMatched);
    plan.put("templateKeyMatched", templateKeyMatched);
    plan.put("payloadParseStatus", payloadValidation.parseStatus());
    plan.put("missingPayloadFields", payloadValidation.missingPayloadFields());
    plan.put("providerCallEnabled", payloadValidation.providerCallEnabled());
    plan.put("providerCallBlocked", payloadValidation.providerCallEnabled());
    plan.put("payloadPreview", payloadValidation.payloadPreview());
    plan.put(
        "blockedReasons",
        blockedReasons(
            route,
            validationSupported,
            adapterInvocationAllowed,
            missingHeaders,
            eventTypeMatched,
            templateKeyMatched,
            payloadValidation));
    return plan;
  }

  private boolean supportsValidation(String route) {
    return NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED.equals(route);
  }

  private PayloadValidation payloadValidation(String payload, boolean validationSupported) {
    if (!validationSupported) {
      return PayloadValidation.unsupported();
    }
    if (!StringUtils.hasText(payload)) {
      return PayloadValidation.blocked("empty_payload", Map.of(), List.of("payload"));
    }
    Map<String, Object> parsed;
    try {
      parsed = JSON.readValue(payload, MAP_TYPE);
    } catch (Exception ignored) {
      return PayloadValidation.blocked("invalid_json", Map.of(), List.of("payload"));
    }
    if (parsed == null) {
      return PayloadValidation.blocked("null_payload", Map.of(), List.of("payload"));
    }
    List<String> missing = missingPayloadFields(parsed);
    boolean providerCallEnabled = booleanValue(parsed.get("providerCallEnabled"));
    boolean passed = missing.isEmpty() && !providerCallEnabled;
    return new PayloadValidation(
        passed,
        "valid_json",
        missing,
        providerCallEnabled,
        payloadPreview(parsed));
  }

  private List<String> missingHeaders(
      Map<String, Object> routingPlan, Map<String, Object> headers) {
    List<String> missing = new ArrayList<>();
    if (!StringUtils.hasText(stringValue(headers.get("eventId")))
        && !StringUtils.hasText(stringValue(routingPlan.get("messageId")))) {
      missing.add("eventId");
    }
    if (!StringUtils.hasText(stringValue(headers.get("idempotencyKey")))) {
      missing.add("idempotencyKey");
    }
    if (!StringUtils.hasText(stringValue(headers.get("eventType")))) {
      missing.add("eventType");
    }
    if (!StringUtils.hasText(stringValue(headers.get("templateKey")))) {
      missing.add("templateKey");
    }
    return missing;
  }

  private List<String> missingPayloadFields(Map<String, Object> payload) {
    List<String> missing = new ArrayList<>();
    if (intValue(payload.get("jobId")) == null) {
      missing.add("jobId");
    }
    if (!StringUtils.hasText(stringValue(payload.get("targetCustomerId")))) {
      missing.add("targetCustomerId");
    }
    if (!StringUtils.hasText(stringValue(payload.get("targetDbName")))) {
      missing.add("targetDbName");
    }
    return missing;
  }

  private Map<String, Object> payloadPreview(Map<String, Object> payload) {
    Map<String, Object> preview = new LinkedHashMap<>();
    putIfPresent(preview, "jobId", intValue(payload.get("jobId")));
    putIfPresent(preview, "targetCustomerId", payload.get("targetCustomerId"));
    putIfPresent(preview, "targetDbName", payload.get("targetDbName"));
    putIfPresent(preview, "templateKey", payload.get("templateKey"));
    putIfPresent(preview, "providerCallEnabled", booleanValue(payload.get("providerCallEnabled")));
    return preview;
  }

  private List<String> blockedReasons(
      String route,
      boolean validationSupported,
      boolean adapterInvocationAllowed,
      List<String> missingHeaders,
      boolean eventTypeMatched,
      boolean templateKeyMatched,
      PayloadValidation payloadValidation) {
    List<String> reasons = new ArrayList<>();
    if (!validationSupported) {
      reasons.add("route 尚未接入请求校验 dry-run: " + route);
    }
    if (!adapterInvocationAllowed) {
      reasons.add("adapter 调用计划未放行，不能校验真实请求构造");
    }
    if (!missingHeaders.isEmpty()) {
      reasons.add("headers 缺少必填字段: " + String.join(",", missingHeaders));
    }
    if (!eventTypeMatched) {
      reasons.add("eventType 与组织开通完成 notification 不匹配");
    }
    if (!templateKeyMatched) {
      reasons.add("templateKey 与组织开通完成 notification 不匹配");
    }
    if (validationSupported && !payloadValidation.passed()) {
      reasons.addAll(payloadBlockedReasons(payloadValidation));
    }
    reasons.add("本批只做 adapter 请求校验 dry-run，不调用专用 consumer");
    return reasons.stream().filter(StringUtils::hasText).distinct().toList();
  }

  private List<String> payloadBlockedReasons(PayloadValidation validation) {
    List<String> reasons = new ArrayList<>();
    if (!"valid_json".equals(validation.parseStatus())) {
      reasons.add("payload 不是合法组织开通完成 notification JSON: " + validation.parseStatus());
    }
    if (!validation.missingPayloadFields().isEmpty()) {
      reasons.add(
          "payload 缺少必填字段: " + String.join(",", validation.missingPayloadFields()));
    }
    if (validation.providerCallEnabled()) {
      reasons.add("providerCallEnabled=true 当前仍被 adapter 请求校验阻断");
    }
    return reasons;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> headers(Map<String, Object> routingPlan) {
    Object value = routingPlan.get("headers");
    if (value instanceof Map<?, ?> map) {
      return (Map<String, Object>) map;
    }
    return Map.of();
  }

  private void putIfPresent(Map<String, Object> target, String key, Object value) {
    if (value == null) {
      return;
    }
    if (value instanceof String text && !StringUtils.hasText(text)) {
      return;
    }
    target.put(key, value);
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

  private Integer intValue(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (value instanceof String text && StringUtils.hasText(text)) {
      try {
        return Integer.parseInt(text);
      } catch (NumberFormatException ignored) {
        return null;
      }
    }
    return null;
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private record PayloadValidation(
      boolean passed,
      String parseStatus,
      List<String> missingPayloadFields,
      boolean providerCallEnabled,
      Map<String, Object> payloadPreview) {

    static PayloadValidation unsupported() {
      return new PayloadValidation(false, "not_supported", List.of(), false, Map.of());
    }

    static PayloadValidation blocked(
        String parseStatus, Map<String, Object> payloadPreview, List<String> missingFields) {
      return new PayloadValidation(false, parseStatus, missingFields, false, payloadPreview);
    }
  }
}

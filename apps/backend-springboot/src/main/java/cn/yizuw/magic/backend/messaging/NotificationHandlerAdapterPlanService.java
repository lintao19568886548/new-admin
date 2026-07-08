package cn.yizuw.magic.backend.messaging;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 通用 notification 专用 handler adapter 计划；当前只 dry-run，不调用真实 handler。 */
@Service
public class NotificationHandlerAdapterPlanService {

  private static final String ORGANIZATION_ADAPTER_BEAN =
      "organizationProvisioningCompletedNotificationConsumerAdapter";
  private static final String ORGANIZATION_REQUEST_TYPE =
      "OrganizationProvisioningCompletedNotificationConsumeRequest";

  /**
   * 生成通用 listener 到专用 handler 的 adapter 调用计划。
   *
   * <p>本方法只选择 adapter 并预览将来要构造的请求字段，不调用专用 consumer，
   * 不写消费日志，也不确认 RabbitMQ 消息。
   */
  public Map<String, Object> buildPlan(
      Map<String, Object> routingPlan,
      Map<String, Object> dispatchPlan,
      String payload) {
    String route = stringValue(first(dispatchPlan, routingPlan, "route"));
    String targetHandlerBean = stringValue(first(dispatchPlan, routingPlan, "handlerBean"));
    boolean routeSupported = booleanValue(first(dispatchPlan, routingPlan, "routeSupported"));
    boolean dispatchAllowed = booleanValue(dispatchPlan.get("dispatchAllowed"));
    boolean adapterSupported = adapterSupported(route);
    boolean adapterInvocationAllowed = routeSupported && dispatchAllowed && adapterSupported;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", "notification.handler.adapter.plan");
    plan.put("planStatus", "dry_run");
    plan.put("route", route);
    plan.put("routeSupported", routeSupported);
    plan.put("targetHandlerBean", targetHandlerBean);
    plan.put("adapterBean", adapterBean(route));
    plan.put("adapterSupported", adapterSupported);
    plan.put("adapterSelected", adapterInvocationAllowed);
    plan.put("dispatchAllowed", dispatchAllowed);
    plan.put("adapterInvocationAllowed", adapterInvocationAllowed);
    plan.put("adapterInvocationRequested", false);
    plan.put("adapterInvocationExecuted", false);
    plan.put("requestType", requestType(route));
    plan.put("requestPreview", requestPreview(route, routingPlan, payload));
    plan.put(
        "blockedReasons",
        blockedReasons(route, routeSupported, dispatchAllowed, adapterSupported));
    return plan;
  }

  private boolean adapterSupported(String route) {
    return NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED.equals(route);
  }

  private String adapterBean(String route) {
    if (adapterSupported(route)) {
      return ORGANIZATION_ADAPTER_BEAN;
    }
    return "";
  }

  private String requestType(String route) {
    if (adapterSupported(route)) {
      return ORGANIZATION_REQUEST_TYPE;
    }
    return "";
  }

  private Map<String, Object> requestPreview(
      String route, Map<String, Object> routingPlan, String payload) {
    if (!adapterSupported(route)) {
      return Map.of();
    }
    Map<String, Object> headers = headers(routingPlan);
    Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("eventId", stringValue(headers.get("eventId")));
    preview.put("idempotencyKey", stringValue(headers.get("idempotencyKey")));
    preview.put("messageId", stringValue(routingPlan.get("messageId")));
    preview.put("eventType", stringValue(headers.get("eventType")));
    preview.put("templateKey", stringValue(headers.get("templateKey")));
    preview.put("payloadForwarding", "raw_body_to_dedicated_request");
    preview.put("payloadSizeBytes", payloadSizeBytes(payload));
    return preview;
  }

  private List<String> blockedReasons(
      String route, boolean routeSupported, boolean dispatchAllowed, boolean adapterSupported) {
    List<String> reasons = new ArrayList<>();
    if (!routeSupported) {
      reasons.add("route 不支持，不能选择 handler adapter");
    }
    if (!dispatchAllowed) {
      reasons.add("分发预检未通过，不能进入 handler adapter 调用");
    }
    if (!adapterSupported) {
      reasons.add("route 尚未接入专用 handler adapter dry-run: " + route);
    }
    reasons.add("本批只生成 handler adapter 调用计划 dry-run，不调用 handler");
    return reasons.stream().filter(StringUtils::hasText).distinct().toList();
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> headers(Map<String, Object> routingPlan) {
    Object value = routingPlan.get("headers");
    if (value instanceof Map<?, ?> map) {
      return (Map<String, Object>) map;
    }
    return Map.of();
  }

  private Object first(
      Map<String, Object> primary, Map<String, Object> fallback, String key) {
    Object value = primary.get(key);
    return value == null ? fallback.get(key) : value;
  }

  private boolean booleanValue(Object value) {
    return Boolean.TRUE.equals(value);
  }

  private int payloadSizeBytes(String payload) {
    if (payload == null) {
      return 0;
    }
    return payload.getBytes(StandardCharsets.UTF_8).length;
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

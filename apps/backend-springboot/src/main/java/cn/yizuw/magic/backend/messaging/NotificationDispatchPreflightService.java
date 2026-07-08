package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 通用 notification 分发前置校验；当前只 dry-run，不调用任何专用 handler。 */
@Service
public class NotificationDispatchPreflightService {

  private final AppProperties appProperties;

  public NotificationDispatchPreflightService(AppProperties appProperties) {
    this.appProperties = appProperties;
  }

  /**
   * 基于路由计划生成分发前置校验结果。
   *
   * <p>本方法只判断 route 是否支持、handler 是否已登记、分发安全门是否开启；不调用 handler、
   * 不写 `event_consume_log`，也不 ack/nack RabbitMQ 消息。
   */
  public Map<String, Object> buildPlan(Map<String, Object> routingPlan) {
    String route = stringValue(routingPlan.get("route"));
    String handlerBean = stringValue(routingPlan.get("handlerBean"));
    boolean routeSupported = Boolean.TRUE.equals(routingPlan.get("routeSupported"));
    boolean dispatchEnabled = appProperties.getRabbitMq().isNotificationDispatchEnabled();
    boolean handlerReady = handlerReady(route, handlerBean);
    boolean dispatchAllowed = routeSupported && dispatchEnabled && handlerReady;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", "notification.dispatch.preflight");
    plan.put("planStatus", "dry_run");
    plan.put("route", route);
    plan.put("handlerBean", handlerBean);
    plan.put("routeSupported", routeSupported);
    plan.put("handlerReady", handlerReady);
    plan.put("dispatchEnabled", dispatchEnabled);
    plan.put("dispatchAllowed", dispatchAllowed);
    plan.put("dispatchExecuted", false);
    plan.put("ackStrategy", "throw_to_avoid_ack");
    plan.put(
        "blockedReasons",
        blockedReasons(route, routeSupported, dispatchEnabled, handlerReady));
    return plan;
  }

  private boolean handlerReady(String route, String handlerBean) {
    if (!StringUtils.hasText(route) || !StringUtils.hasText(handlerBean)) {
      return false;
    }
    return NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED.equals(route);
  }

  private List<String> blockedReasons(
      String route, boolean routeSupported, boolean dispatchEnabled, boolean handlerReady) {
    List<String> reasons = new ArrayList<>();
    if (!routeSupported) {
      reasons.add("route 不支持，不能分发");
    }
    if (!dispatchEnabled) {
      reasons.add("RABBITMQ_NOTIFICATION_DISPATCH_ENABLED 未开启");
    }
    if (!handlerReady) {
      reasons.add("route 尚未登记可分发专用 handler: " + route);
    }
    reasons.add("本批只做分发前置校验 dry-run，不调用 handler");
    return reasons.stream().filter(StringUtils::hasText).distinct().toList();
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

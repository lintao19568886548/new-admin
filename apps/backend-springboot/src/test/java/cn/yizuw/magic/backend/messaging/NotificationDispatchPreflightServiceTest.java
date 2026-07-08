package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** notification 通用分发预检测试；只校验 dry-run 安全门，不触发真实 handler。 */
class NotificationDispatchPreflightServiceTest {

  private AppProperties appProperties;
  private NotificationDispatchPreflightService service;

  @BeforeEach
  void setUp() {
    appProperties = new AppProperties();
    service = new NotificationDispatchPreflightService(appProperties);
  }

  @Test
  void buildPlanBlocksReadyOrganizationRouteWhenDispatchSwitchIsDisabled() {
    Map<String, Object> plan =
        service.buildPlan(
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
                "routeSupported",
                true,
                "handlerBean",
                "organizationProvisioningCompletedNotificationConsumerService"));

    assertThat(plan)
        .containsEntry("planType", "notification.dispatch.preflight")
        .containsEntry("planStatus", "dry_run")
        .containsEntry(
            "route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED)
        .containsEntry("handlerReady", true)
        .containsEntry("dispatchEnabled", false)
        .containsEntry("dispatchAllowed", false)
        .containsEntry("dispatchExecuted", false)
        .containsEntry("ackStrategy", "throw_to_avoid_ack");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "RABBITMQ_NOTIFICATION_DISPATCH_ENABLED 未开启",
            "本批只做分发前置校验 dry-run，不调用 handler");
  }

  @Test
  void buildPlanAllowsReadyOrganizationRouteWhenSwitchIsEnabledButStillDoesNotExecute() {
    appProperties.getRabbitMq().setNotificationDispatchEnabled(true);

    Map<String, Object> plan =
        service.buildPlan(
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
                "routeSupported",
                true,
                "handlerBean",
                "organizationProvisioningCompletedNotificationConsumerService"));

    assertThat(plan)
        .containsEntry("dispatchEnabled", true)
        .containsEntry("handlerReady", true)
        .containsEntry("dispatchAllowed", true)
        .containsEntry("dispatchExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("本批只做分发前置校验 dry-run，不调用 handler");
  }

  @Test
  void buildPlanBlocksUnknownRoute() {
    appProperties.getRabbitMq().setNotificationDispatchEnabled(true);

    Map<String, Object> plan =
        service.buildPlan(
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_UNKNOWN,
                "routeSupported",
                false,
                "handlerBean",
                ""));

    assertThat(plan)
        .containsEntry("route", NotificationRoutingPlanService.ROUTE_UNKNOWN)
        .containsEntry("routeSupported", false)
        .containsEntry("handlerReady", false)
        .containsEntry("dispatchAllowed", false)
        .containsEntry("dispatchExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "route 不支持，不能分发",
            "route 尚未登记可分发专用 handler: "
                + NotificationRoutingPlanService.ROUTE_UNKNOWN,
            "本批只做分发前置校验 dry-run，不调用 handler");
  }

  @Test
  void buildPlanBlocksSupportedRouteBeforeDedicatedHandlerIsRegistered() {
    appProperties.getRabbitMq().setNotificationDispatchEnabled(true);

    Map<String, Object> plan =
        service.buildPlan(
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
                "routeSupported",
                true,
                "handlerBean",
                "contractReminderSmsNotificationConsumer"));

    assertThat(plan)
        .containsEntry("route", NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS)
        .containsEntry("routeSupported", true)
        .containsEntry("handlerReady", false)
        .containsEntry("dispatchAllowed", false)
        .containsEntry("dispatchExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "route 尚未登记可分发专用 handler: "
                + NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
            "本批只做分发前置校验 dry-run，不调用 handler");
  }
}

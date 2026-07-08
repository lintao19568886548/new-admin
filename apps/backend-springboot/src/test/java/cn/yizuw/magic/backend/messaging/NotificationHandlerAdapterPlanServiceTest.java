package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** notification handler adapter 计划测试；只校验 dry-run 选择逻辑。 */
class NotificationHandlerAdapterPlanServiceTest {

  private final NotificationHandlerAdapterPlanService service =
      new NotificationHandlerAdapterPlanService();

  @Test
  void buildPlanSelectsOrganizationAdapterWhenDispatchPreflightAllows() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\"}";

    Map<String, Object> plan =
        service.buildPlan(
            organizationRoutingPlan(),
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
                "routeSupported",
                true,
                "handlerBean",
                "organizationProvisioningCompletedNotificationConsumerService",
                "dispatchAllowed",
                true),
            payload);

    assertThat(plan)
        .containsEntry("planType", "notification.handler.adapter.plan")
        .containsEntry("planStatus", "dry_run")
        .containsEntry(
            "route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED)
        .containsEntry(
            "targetHandlerBean", "organizationProvisioningCompletedNotificationConsumerService")
        .containsEntry(
            "adapterBean", "organizationProvisioningCompletedNotificationConsumerAdapter")
        .containsEntry("adapterSupported", true)
        .containsEntry("adapterSelected", true)
        .containsEntry("adapterInvocationAllowed", true)
        .containsEntry("adapterInvocationRequested", false)
        .containsEntry("adapterInvocationExecuted", false)
        .containsEntry(
            "requestType", "OrganizationProvisioningCompletedNotificationConsumeRequest");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("本批只生成 handler adapter 调用计划 dry-run，不调用 handler");

    @SuppressWarnings("unchecked")
    Map<String, Object> requestPreview = (Map<String, Object>) plan.get("requestPreview");
    assertThat(requestPreview)
        .containsEntry("eventId", "evt-org-notification-1")
        .containsEntry("idempotencyKey", "organization-provisioning-completed-notification:31")
        .containsEntry("messageId", "msg-org-notification-1")
        .containsEntry(
            "eventType", OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE)
        .containsEntry(
            "templateKey", OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY)
        .containsEntry("payloadForwarding", "raw_body_to_dedicated_request")
        .containsEntry("payloadSizeBytes", payload.getBytes(StandardCharsets.UTF_8).length);
  }

  @Test
  void buildPlanBlocksOrganizationAdapterWhenDispatchPreflightBlocks() {
    Map<String, Object> plan =
        service.buildPlan(
            organizationRoutingPlan(),
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
                "routeSupported",
                true,
                "handlerBean",
                "organizationProvisioningCompletedNotificationConsumerService",
                "dispatchAllowed",
                false),
            "{}");

    assertThat(plan)
        .containsEntry("adapterSupported", true)
        .containsEntry("adapterSelected", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("adapterInvocationExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "分发预检未通过，不能进入 handler adapter 调用",
            "本批只生成 handler adapter 调用计划 dry-run，不调用 handler");
  }

  @Test
  void buildPlanBlocksSupportedRouteBeforeAdapterIsRegistered() {
    Map<String, Object> plan =
        service.buildPlan(
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
                "routeSupported",
                true,
                "handlerBean",
                "contractReminderSmsNotificationConsumer"),
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
                "routeSupported",
                true,
                "handlerBean",
                "contractReminderSmsNotificationConsumer",
                "dispatchAllowed",
                true),
            "{\"source\":\"contract_reminder_sms\"}");

    assertThat(plan)
        .containsEntry("route", NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS)
        .containsEntry("adapterSupported", false)
        .containsEntry("adapterSelected", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("requestType", "");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "route 尚未接入专用 handler adapter dry-run: "
                + NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
            "本批只生成 handler adapter 调用计划 dry-run，不调用 handler");
  }

  @Test
  void buildPlanBlocksUnknownRoute() {
    Map<String, Object> plan =
        service.buildPlan(
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_UNKNOWN,
                "routeSupported",
                false,
                "handlerBean",
                ""),
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_UNKNOWN,
                "routeSupported",
                false,
                "handlerBean",
                "",
                "dispatchAllowed",
                false),
            "{bad-json");

    assertThat(plan)
        .containsEntry("route", NotificationRoutingPlanService.ROUTE_UNKNOWN)
        .containsEntry("routeSupported", false)
        .containsEntry("adapterSupported", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("requestPreview", Map.of());
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "route 不支持，不能选择 handler adapter",
            "分发预检未通过，不能进入 handler adapter 调用",
            "route 尚未接入专用 handler adapter dry-run: "
                + NotificationRoutingPlanService.ROUTE_UNKNOWN,
            "本批只生成 handler adapter 调用计划 dry-run，不调用 handler");
  }

  private Map<String, Object> organizationRoutingPlan() {
    return Map.of(
        "messageId",
        "msg-org-notification-1",
        "route",
        NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
        "routeSupported",
        true,
        "handlerBean",
        "organizationProvisioningCompletedNotificationConsumerService",
        "headers",
        Map.of(
            "eventId",
            "evt-org-notification-1",
            "eventType",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            "idempotencyKey",
            "organization-provisioning-completed-notification:31",
            "templateKey",
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY));
  }
}

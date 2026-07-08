package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import cn.yizuw.magic.backend.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** notification 专用 consumer 委托计划测试；验证真实委托前置条件和安全边界。 */
class NotificationConsumerDelegationPlanServiceTest {

  private AppProperties appProperties;
  private NotificationConsumerDelegationPlanService service;

  @BeforeEach
  void setUp() {
    appProperties = new AppProperties();
    NotificationInAppProviderConsumerResultValidationPlanService validationPlanService =
        new NotificationInAppProviderConsumerResultValidationPlanService();
    service =
        new NotificationConsumerDelegationPlanService(
            appProperties,
            new NotificationInAppProviderAutoExecutionAdapterPlanService(
                appProperties,
                validationPlanService,
                new NotificationInAppProviderListenerNoopPlanService(
                    appProperties, validationPlanService)));
  }

  @Test
  void buildPlanBlocksOrganizationDelegationWhenSafetyGateIsDisabled() {
    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), organizationValidationPlan(true), payload());

    assertThat(plan)
        .containsEntry("delegationSupported", true)
        .containsEntry("requestValidationPassed", true)
        .containsEntry("requestTypeMatched", true)
        .containsEntry("delegationEnabled", false)
        .containsEntry(
            "routeGuard", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED)
        .containsEntry("routeGuardMatched", true)
        .containsEntry("providerCallEnabled", false)
        .containsEntry("providerCallBlocked", false)
        .containsEntry("delegationAllowed", false)
        .containsEntry("planStatus", "blocked")
        .containsEntry("consumerInvocationMode", "blocked_before_delegation")
        .containsEntry("ackStrategy", "throw_to_avoid_ack")
        .containsEntry("nextAction", "fix_blocked_readiness_checks_before_real_delegation")
        .containsEntry("delegationExecuted", false);
    assertThat((List<Object>) plan.get("delegationReadinessFailedChecks"))
        .containsExactly("delegation_gate_enabled");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ENABLED 未开启",
            "未满足真实委托条件，listener 必须抛错避免 ack");
    assertThat((Map<String, Object>) plan.get("inAppProviderAutoExecutionAdapterPlan"))
        .containsEntry("planStatus", "blocked")
        .containsEntry("resultAdapterEnabled", false)
        .containsEntry("adapterInvocationExecuted", false)
        .containsEntry("manualExecutionExecuted", false);
    assertReadinessMatrix(plan, "delegation_gate_enabled", false);
    assertReadinessMatrix(plan, "plan_side_effect_free", true);
  }

  @Test
  void buildPlanPreviewsOrganizationConsumerRequestAndResultFieldsWhenGateIsEnabled() {
    appProperties.getRabbitMq().setNotificationConsumerDelegationEnabled(true);
    String payload = payload();

    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), organizationValidationPlan(true), payload);

    assertThat(plan)
        .containsEntry("planType", "notification.consumer.delegation.plan")
        .containsEntry("planStatus", "ready")
        .containsEntry(
            "route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED)
        .containsEntry(
            "consumerBean", "organizationProvisioningCompletedNotificationConsumerService")
        .containsEntry("consumerMethod", "consume")
        .containsEntry("delegationSupported", true)
        .containsEntry("requestValidationPassed", true)
        .containsEntry("requestTypeMatched", true)
        .containsEntry("delegationEnabled", true)
        .containsEntry(
            "routeGuard", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED)
        .containsEntry("routeGuardMatched", true)
        .containsEntry("providerCallEnabled", false)
        .containsEntry("providerCallBlocked", false)
        .containsEntry("delegationAllowed", true)
        .containsEntry("consumerInvocationMode", "real_delegation_allowed")
        .containsEntry("ackStrategy", "delegate_then_ack_success_or_duplicate")
        .containsEntry(
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate")
        .containsEntry("delegationRequested", false)
        .containsEntry("delegationExecuted", false)
        .containsEntry("handlerInvocationExecuted", false);
    assertThat((List<Object>) plan.get("delegationReadinessFailedChecks")).isEmpty();
    assertThat((List<Object>) plan.get("blockedReasons")).isEmpty();
    assertReadinessMatrix(plan, "route_supported", true);
    assertReadinessMatrix(plan, "request_validation_passed", true);
    assertReadinessMatrix(plan, "request_type_matched", true);
    assertReadinessMatrix(plan, "delegation_gate_enabled", true);
    assertReadinessMatrix(plan, "route_guard_matched", true);
    assertReadinessMatrix(plan, "provider_call_disabled", true);
    assertReadinessMatrix(plan, "plan_side_effect_free", true);
    assertThat((Map<String, Object>) plan.get("inAppProviderAutoExecutionAdapterPlan"))
        .containsEntry("planStatus", "blocked")
        .containsEntry("resultAdapterEnabled", false)
        .containsEntry("adapterInvocationAllowed", false)
        .containsEntry("adapterInvocationExecuted", false)
        .containsEntry("manualExecutionExecuted", false)
        .containsEntry("rabbitAckExecuted", false);

    @SuppressWarnings("unchecked")
    Map<String, Object> requestPreview = (Map<String, Object>) plan.get("requestPreview");
    assertThat(requestPreview)
        .containsEntry(
            "requestType", "OrganizationProvisioningCompletedNotificationConsumeRequest")
        .containsEntry("eventId", "evt-org-notification-1")
        .containsEntry("idempotencyKey", "organization-provisioning-completed-notification:31")
        .containsEntry("messageId", "msg-org-notification-1")
        .containsEntry(
            "eventType", OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE)
        .containsEntry(
            "templateKey", OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY)
        .containsEntry("payloadForwarding", "raw_body_to_consumer_request")
        .containsEntry("payloadSizeBytes", payload.getBytes(StandardCharsets.UTF_8).length);
    assertThat((Map<String, Object>) requestPreview.get("validatedPayloadPreview"))
        .containsEntry("jobId", 31)
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001");

    @SuppressWarnings("unchecked")
    Map<String, Object> resultPreview = (Map<String, Object>) plan.get("resultPreview");
    assertThat(resultPreview)
        .containsEntry("resultType", "OrganizationProvisioningCompletedNotificationConsumeResult")
        .containsEntry("resultGenerated", false)
        .containsEntry("resultSource", "pending_dedicated_consumer_execution");
    assertThat((List<Object>) resultPreview.get("expectedFields"))
        .contains(
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

  @Test
  void buildPlanBlocksWhenRequestValidationFailed() {
    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), organizationValidationPlan(false), payload());

    assertThat(plan)
        .containsEntry("delegationSupported", true)
        .containsEntry("requestValidationPassed", false)
        .containsEntry("nextAction", "fix_blocked_readiness_checks_before_real_delegation")
        .containsEntry("delegationAllowed", false)
        .containsEntry("delegationExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "adapter 请求校验未通过，不能进入专用 consumer 委托计划",
            "未满足真实委托条件，listener 必须抛错避免 ack");
    assertReadinessMatrix(plan, "request_validation_passed", false);
  }

  @Test
  void buildPlanBlocksWhenRouteGuardDoesNotMatch() {
    appProperties.getRabbitMq().setNotificationConsumerDelegationEnabled(true);
    appProperties
        .getRabbitMq()
        .setNotificationConsumerDelegationRouteGuard(
            NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS);

    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), organizationValidationPlan(true), payload());

    assertThat(plan)
        .containsEntry("delegationSupported", true)
        .containsEntry("delegationEnabled", true)
        .containsEntry("routeGuard", NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS)
        .containsEntry("routeGuardMatched", false)
        .containsEntry("nextAction", "fix_blocked_readiness_checks_before_real_delegation")
        .containsEntry("delegationAllowed", false)
        .containsEntry("delegationExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "route 与 RABBITMQ_NOTIFICATION_CONSUMER_DELEGATION_ROUTE_GUARD 不匹配",
            "未满足真实委托条件，listener 必须抛错避免 ack");
    assertReadinessMatrix(plan, "route_guard_matched", false);
  }

  @Test
  void buildPlanBlocksUnsupportedRoute() {
    Map<String, Object> plan =
        service.buildPlan(
            Map.of("route", NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS),
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
                "requestValidationPassed",
                true,
                "requestType",
                ""),
            "{\"source\":\"contract_reminder_sms\"}");

    assertThat(plan)
        .containsEntry("route", NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS)
        .containsEntry("consumerBean", "")
        .containsEntry("delegationSupported", false)
        .containsEntry("delegationAllowed", false)
        .containsEntry("consumerInvocationMode", "blocked_before_delegation")
        .containsEntry("ackStrategy", "throw_to_avoid_ack")
        .containsEntry("requestPreview", Map.of())
        .containsEntry("resultPreview", Map.of());
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "route 尚未接入专用 consumer 委托 dry-run: "
                + NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
            "未满足真实委托条件，listener 必须抛错避免 ack");
    assertReadinessMatrix(plan, "route_supported", false);
  }

  @Test
  void buildPlanBlocksUnexpectedRequestType() {
    Map<String, Object> validationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "requestValidationPassed",
            true,
            "requestType",
            "UnexpectedRequest",
            "payloadPreview",
            Map.of("jobId", 31));

    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), validationPlan, payload());

    assertThat(plan)
        .containsEntry("delegationSupported", true)
        .containsEntry("requestValidationPassed", true)
        .containsEntry("requestTypeMatched", false)
        .containsEntry("delegationAllowed", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "requestType 与组织开通完成 notification consumer 不匹配",
            "未满足真实委托条件，listener 必须抛错避免 ack");
    assertReadinessMatrix(plan, "request_type_matched", false);
  }

  @Test
  void buildPlanKeepsProviderCallEnabledBlockedInReadinessMatrix() {
    appProperties.getRabbitMq().setNotificationConsumerDelegationEnabled(true);
    Map<String, Object> validationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "requestValidationPassed",
            false,
            "requestType",
            "OrganizationProvisioningCompletedNotificationConsumeRequest",
            "providerCallEnabled",
            true,
            "providerCallBlocked",
            true,
            "payloadPreview",
            Map.of(
                "jobId",
                31,
                "targetCustomerId",
                "org001",
                "targetDbName",
                "tenant_org001",
                "providerCallEnabled",
                true));

    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), validationPlan, payload(true));

    assertThat(plan)
        .containsEntry("providerCallEnabled", true)
        .containsEntry("providerCallBlocked", true)
        .containsEntry("delegationAllowed", false)
        .containsEntry("consumerInvocationMode", "blocked_before_delegation")
        .containsEntry("ackStrategy", "throw_to_avoid_ack")
        .containsEntry("handlerInvocationExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "adapter 请求校验未通过，不能进入专用 consumer 委托计划",
            "provider 调用开关未关闭，不能进入专用 consumer 委托计划",
            "未满足真实委托条件，listener 必须抛错避免 ack");
    assertReadinessMatrix(plan, "provider_call_disabled", false);
  }

  @Test
  void buildPlanStillBlocksProviderCallEvenIfUpstreamValidationIsWronglyMarkedPassed() {
    appProperties.getRabbitMq().setNotificationConsumerDelegationEnabled(true);
    Map<String, Object> validationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "requestValidationPassed",
            true,
            "requestType",
            "OrganizationProvisioningCompletedNotificationConsumeRequest",
            "providerCallEnabled",
            true,
            "providerCallBlocked",
            true,
            "payloadPreview",
            Map.of("jobId", 31));

    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), validationPlan, payload(true));

    assertThat(plan)
        .containsEntry("requestValidationPassed", true)
        .containsEntry("providerCallEnabled", true)
        .containsEntry("providerCallBlocked", true)
        .containsEntry("delegationAllowed", false)
        .containsEntry("nextAction", "fix_blocked_readiness_checks_before_real_delegation");
    assertThat((List<Object>) plan.get("delegationReadinessFailedChecks"))
        .containsExactly("provider_call_disabled");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains("provider 调用开关未关闭，不能进入专用 consumer 委托计划");
    assertReadinessMatrix(plan, "provider_call_disabled", false);
  }

  private void assertReadinessMatrix(
      Map<String, Object> plan, String expectedName, boolean expectedPassed) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> matrix =
        (List<Map<String, Object>>) plan.get("delegationReadinessMatrix");
    assertThat(matrix)
        .anySatisfy(
            check ->
                assertThat(check)
                    .containsEntry("name", expectedName)
                    .containsEntry("passed", expectedPassed));
  }

  private Map<String, Object> organizationRoutingPlan() {
    return Map.of(
        "messageId",
        "msg-org-notification-1",
        "route",
        NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
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

  private Map<String, Object> organizationValidationPlan(boolean passed) {
    return Map.of(
        "route",
        NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
        "requestValidationPassed",
        passed,
        "requestType",
        "OrganizationProvisioningCompletedNotificationConsumeRequest",
        "payloadPreview",
        Map.of(
            "jobId",
            31,
            "targetCustomerId",
            "org001",
            "targetDbName",
            "tenant_org001"));
  }

  private String payload() {
    return payload(false);
  }

  private String payload(boolean providerCallEnabled) {
    return """
        {
          "jobId": 31,
          "targetCustomerId": "org001",
          "targetDbName": "tenant_org001",
          "templateKey": "organization_provisioning_completed",
          "channels": ["in_app", "sms"],
          "providerCallEnabled": %s
        }
        """
        .formatted(providerCallEnabled);
  }
}

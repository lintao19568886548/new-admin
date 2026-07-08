package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** notification adapter 请求校验计划测试；只验证 dry-run 校验结果。 */
class NotificationAdapterRequestValidationPlanServiceTest {

  private final NotificationAdapterRequestValidationPlanService service =
      new NotificationAdapterRequestValidationPlanService();

  @Test
  void buildPlanPassesValidOrganizationRequestWhenAdapterAllows() {
    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), organizationAdapterPlan(true), payload(false));

    assertThat(plan)
        .containsEntry("planType", "notification.adapter.request.validation")
        .containsEntry("planStatus", "dry_run")
        .containsEntry(
            "route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED)
        .containsEntry("adapterInvocationAllowed", true)
        .containsEntry("validationSupported", true)
        .containsEntry("requestValidationPassed", true)
        .containsEntry("requestValidationStatus", "ready")
        .containsEntry("requestValidationRequested", false)
        .containsEntry("requestValidationExecuted", false)
        .containsEntry("handlerInvocationExecuted", false)
        .containsEntry("eventTypeMatched", true)
        .containsEntry("templateKeyMatched", true)
        .containsEntry("payloadParseStatus", "valid_json")
        .containsEntry("providerCallEnabled", false)
        .containsEntry("providerCallBlocked", false);
    assertThat((List<Object>) plan.get("missingHeaders")).isEmpty();
    assertThat((List<Object>) plan.get("missingPayloadFields")).isEmpty();
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("本批只做 adapter 请求校验 dry-run，不调用专用 consumer");

    @SuppressWarnings("unchecked")
    Map<String, Object> payloadPreview = (Map<String, Object>) plan.get("payloadPreview");
    assertThat(payloadPreview)
        .containsEntry("jobId", 31)
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001")
        .containsEntry("templateKey", "organization_provisioning_completed")
        .containsEntry("providerCallEnabled", false);
  }

  @Test
  void buildPlanBlocksMissingHeadersAndPayloadFields() {
    Map<String, Object> routingPlan =
        Map.of(
            "messageId",
            "",
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "headers",
            Map.of("eventType", "wrong_event_type"));

    Map<String, Object> plan =
        service.buildPlan(routingPlan, organizationAdapterPlan(true), "{\"jobId\":31}");

    assertThat(plan)
        .containsEntry("requestValidationPassed", false)
        .containsEntry("requestValidationStatus", "blocked")
        .containsEntry("eventTypeMatched", false)
        .containsEntry("templateKeyMatched", false)
        .containsEntry("payloadParseStatus", "valid_json")
        .containsEntry("providerCallEnabled", false);
    assertThat((List<Object>) plan.get("missingHeaders"))
        .containsExactly("eventId", "idempotencyKey", "templateKey");
    assertThat((List<Object>) plan.get("missingPayloadFields"))
        .containsExactly("targetCustomerId", "targetDbName");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "headers 缺少必填字段: eventId,idempotencyKey,templateKey",
            "eventType 与组织开通完成 notification 不匹配",
            "templateKey 与组织开通完成 notification 不匹配",
            "payload 缺少必填字段: targetCustomerId,targetDbName",
            "本批只做 adapter 请求校验 dry-run，不调用专用 consumer");
  }

  @Test
  void buildPlanBlocksProviderCallEnabled() {
    Map<String, Object> plan =
        service.buildPlan(
            organizationRoutingPlan(),
            organizationAdapterPlan(true),
            payload("\"true\""));

    assertThat(plan)
        .containsEntry("requestValidationPassed", false)
        .containsEntry("providerCallEnabled", true)
        .containsEntry("providerCallBlocked", true)
        .containsEntry("handlerInvocationExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "providerCallEnabled=true 当前仍被 adapter 请求校验阻断",
            "本批只做 adapter 请求校验 dry-run，不调用专用 consumer");
  }

  @Test
  void buildPlanBlocksInvalidJsonPayload() {
    Map<String, Object> plan =
        service.buildPlan(organizationRoutingPlan(), organizationAdapterPlan(true), "{bad-json");

    assertThat(plan)
        .containsEntry("requestValidationPassed", false)
        .containsEntry("payloadParseStatus", "invalid_json")
        .containsEntry("payloadPreview", Map.of());
    assertThat((List<Object>) plan.get("missingPayloadFields")).containsExactly("payload");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "payload 不是合法组织开通完成 notification JSON: invalid_json",
            "payload 缺少必填字段: payload",
            "本批只做 adapter 请求校验 dry-run，不调用专用 consumer");
  }

  @Test
  void buildPlanBlocksUnsupportedRouteWithoutParsingAsOrganizationRequest() {
    Map<String, Object> plan =
        service.buildPlan(
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
                "headers",
                Map.of()),
            Map.of(
                "route",
                NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
                "adapterInvocationAllowed",
                true,
                "adapterBean",
                "",
                "requestType",
                ""),
            "{\"source\":\"contract_reminder_sms\"}");

    assertThat(plan)
        .containsEntry("route", NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS)
        .containsEntry("validationSupported", false)
        .containsEntry("requestValidationPassed", false)
        .containsEntry("payloadParseStatus", "not_supported")
        .containsEntry("payloadPreview", Map.of())
        .containsEntry("handlerInvocationExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .contains(
            "route 尚未接入请求校验 dry-run: "
                + NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
            "本批只做 adapter 请求校验 dry-run，不调用专用 consumer");
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

  private Map<String, Object> organizationAdapterPlan(boolean adapterInvocationAllowed) {
    return Map.of(
        "route",
        NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
        "adapterBean",
        "organizationProvisioningCompletedNotificationConsumerAdapter",
        "requestType",
        "OrganizationProvisioningCompletedNotificationConsumeRequest",
        "adapterInvocationAllowed",
        adapterInvocationAllowed);
  }

  private String payload(boolean providerCallEnabled) {
    return payload(String.valueOf(providerCallEnabled));
  }

  private String payload(String providerCallEnabled) {
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

package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 共享 notification 队列路由 dry-run 测试；不监听 RabbitMQ，不执行 provider。 */
class NotificationRoutingPlanServiceTest {

  private final NotificationRoutingPlanService service = new NotificationRoutingPlanService();

  @Test
  void buildPlanRoutesOrganizationProvisioningNotificationToDedicatedConsumer() {
    Map<String, Object> plan =
        service.buildPlan(
            "msg-31",
            Map.of(
                "eventType",
                OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
                "templateKey",
                OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY,
                "eventId",
                "evt-31",
                "idempotencyKey",
                "organization-provisioning-completed-notification:31"),
            """
            {
              "jobId": 31,
              "targetCustomerId": "org001",
              "targetDbName": "tenant_org001"
            }
            """);

    assertThat(plan)
        .containsEntry("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED)
        .containsEntry("routeSupported", true)
        .containsEntry(
            "consumerGroup",
            OrganizationProvisioningCompletedNotificationConsumerService.CONSUMER_GROUP)
        .containsEntry("handlerBean", "organizationProvisioningCompletedNotificationConsumerService")
        .containsEntry("providerCallExecuted", false)
        .containsEntry("queueMutationExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("组织开通完成通知仍由专用 consumer 单独灰度");
  }

  @Test
  void buildPlanRoutesContractReminderSmsByPayloadSource() {
    Map<String, Object> plan =
        service.buildPlan(
            "msg-sms-1",
            Map.of("eventType", "contract_reminder_sms"),
            """
            {
              "source": "contract_reminder_sms",
              "phoneNumber": "13800138000",
              "tenantName": "测试租户"
            }
            """);

    assertThat(plan)
        .containsEntry("route", NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS)
        .containsEntry("consumerGroup", "notification-contract-reminder-sms")
        .containsEntry("handlerBean", "contractReminderSmsNotificationConsumer")
        .containsEntry("providerCallEnabled", false);
    @SuppressWarnings("unchecked")
    Map<String, Object> payloadPreview = (Map<String, Object>) plan.get("payloadPreview");
    assertThat(payloadPreview).containsEntry("phoneMasked", "138****8000");
  }

  @Test
  void buildPlanRoutesBillCollectionSmsByTemplateKey() {
    Map<String, Object> plan =
        service.buildPlan(
            "msg-bill-1",
            Map.of("templateKey", "amount_bill_collection_sms"),
            "{\"templateKey\":\"amount_bill_collection_sms\"}");

    assertThat(plan)
        .containsEntry("route", NotificationRoutingPlanService.ROUTE_BILL_COLLECTION_SMS)
        .containsEntry("routeSupported", true)
        .containsEntry("handlerBean", "billCollectionSmsNotificationConsumer");
  }

  @Test
  void buildPlanRoutesLoginSmsCodeBySource() {
    Map<String, Object> plan =
        service.buildPlan(
            "msg-login-1",
            Map.of(),
            "{\"source\":\"login_sms_code\",\"phoneNumber\":\"13900139000\"}");

    assertThat(plan)
        .containsEntry("route", NotificationRoutingPlanService.ROUTE_LOGIN_SMS_CODE)
        .containsEntry("consumerGroup", "notification-login-sms-code")
        .containsEntry("handlerBean", "loginSmsCodeNotificationConsumer");
  }

  @Test
  void buildPlanMarksUnknownMessageAsUnsupportedWithoutAckPlan() {
    Map<String, Object> plan =
        service.buildPlan("msg-unknown", Map.of("eventType", "unknown"), "{bad-json");

    assertThat(plan)
        .containsEntry("route", NotificationRoutingPlanService.ROUTE_UNKNOWN)
        .containsEntry("routeSupported", false)
        .containsEntry("ackStrategy", "defer_to_dedicated_consumer")
        .containsEntry("providerCallExecuted", false)
        .containsEntry("queueMutationExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("无法识别 notification 消息类型，不能由通用 consumer 静默 ack");
  }
}

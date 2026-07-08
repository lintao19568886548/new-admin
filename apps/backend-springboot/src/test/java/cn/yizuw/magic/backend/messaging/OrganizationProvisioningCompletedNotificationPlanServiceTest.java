package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMqTopology;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 组织开通完成通知计划测试；确认安全门和 provider 发送边界。 */
class OrganizationProvisioningCompletedNotificationPlanServiceTest {

  @Test
  void buildPlanReturnsPreviewOnlyNotificationPlanWhenPublishDisabled() {
    Map<String, Object> plan = service(false).buildPlan(31, "org001", "tenant_org001");

    assertThat(plan)
        .containsEntry(
            "planType", OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE)
        .containsEntry("planStatus", "preview_only")
        .containsEntry("jobId", 31)
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001")
        .containsEntry(
            "idempotencyKey", "organization-provisioning-completed-notification:31")
        .containsEntry("notificationExchange", RabbitMqTopology.EXCHANGE_NOTIFICATION)
        .containsEntry("notificationQueue", RabbitMqTopology.QUEUE_NOTIFICATION)
        .containsEntry("notificationRoutingKey", RabbitMqTopology.ROUTING_NOTIFICATION)
        .containsEntry("sendEnabled", false)
        .containsEntry("rabbitNotificationDryRun", true)
        .containsEntry("rabbitNotificationPublishEnabled", false)
        .containsEntry("rabbitNotificationPublishRequested", false)
        .containsEntry("rabbitNotificationPublishExecuted", false)
        .containsEntry("rabbitMessagePreviewGenerated", true)
        .containsEntry("redisRefreshEnabled", false)
        .containsEntry(
            "nextExplicitSwitch", "publishOrganizationProvisioningCompletedNotification");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("RABBITMQ_NOTIFICATION_PUBLISH_ENABLED 未开启");
    assertRabbitMessagePreview(plan);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> channelPlans =
        (List<Map<String, Object>>) plan.get("channelPlans");
    assertThat(channelPlans)
        .hasSize(3)
        .extracting(item -> item.get("channel"))
        .containsExactly("in_app", "wechat_work", "sms");
    assertThat(channelPlans)
        .allSatisfy(
            channelPlan ->
                assertThat(channelPlan)
                    .containsEntry(
                        "idempotencyKey",
                        "organization-provisioning-completed-notification:31:"
                            + channelPlan.get("channel"))
                    .containsEntry("sendEnabled", false)
                    .containsEntry("publishEnabled", false)
                    .containsEntry("publishExecuted", false)
                    .containsEntry("providerCallEnabled", false));
  }

  @Test
  void buildPlanShowsPublishSafetyGateWithoutExecutingProviderSend() {
    Map<String, Object> plan = service(true).buildPlan(31, "org001", "tenant_org001");

    assertThat(plan)
        .containsEntry("rabbitNotificationPublishEnabled", true)
        .containsEntry("rabbitNotificationDryRun", true)
        .containsEntry("rabbitNotificationPublishRequested", false)
        .containsEntry("rabbitNotificationPublishExecuted", false)
        .containsEntry("rabbitMessagePreviewGenerated", true)
        .containsEntry("sendEnabled", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("真实收件人解析和 provider 发送仍未接入，本批只投递 RabbitMQ 通知队列");
    assertRabbitMessagePreview(plan);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> channelPlans =
        (List<Map<String, Object>>) plan.get("channelPlans");
    assertThat(channelPlans)
        .allSatisfy(
            channelPlan ->
                assertThat(channelPlan)
                    .containsEntry("publishEnabled", true)
                    .containsEntry("publishExecuted", false)
                    .containsEntry("providerCallEnabled", false));
  }

  private void assertRabbitMessagePreview(Map<String, Object> plan) {
    @SuppressWarnings("unchecked")
    Map<String, Object> preview = (Map<String, Object>) plan.get("rabbitMessagePreview");
    assertThat(preview)
        .containsEntry("aggregateId", "31")
        .containsEntry("aggregateType", "tenant_provisioning_job")
        .containsEntry("customerId", "org001")
        .containsEntry(
            "idempotencyKey", "organization-provisioning-completed-notification:31")
        .containsEntry("messageId", "organization-provisioning-completed-notification-31")
        .containsEntry("routingKey", RabbitMqTopology.ROUTING_NOTIFICATION)
        .containsEntry("targetExchange", RabbitMqTopology.EXCHANGE_NOTIFICATION)
        .containsEntry("targetQueue", RabbitMqTopology.QUEUE_NOTIFICATION)
        .containsEntry("publishExecuted", false);

    @SuppressWarnings("unchecked")
    Map<String, Object> headers = (Map<String, Object>) preview.get("headers");
    assertThat(headers)
        .containsEntry(
            "eventType", OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE)
        .containsEntry("source", "organization_provisioning_completed_followup")
        .containsEntry(
            "templateKey", OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);

    @SuppressWarnings("unchecked")
    Map<String, Object> payload = (Map<String, Object>) preview.get("payload");
    assertThat(payload)
        .containsEntry("jobId", 31)
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001")
        .containsEntry(
            "templateKey", OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY)
        .containsEntry("recipientResolution", "deferred_to_notification_sender")
        .containsEntry("providerCallEnabled", false);
    assertThat((List<Object>) payload.get("channels"))
        .containsExactly("in_app", "wechat_work", "sms");
  }

  private OrganizationProvisioningCompletedNotificationPlanService service(
      boolean notificationPublishEnabled) {
    AppProperties appProperties = new AppProperties();
    appProperties.getRabbitMq().setNotificationPublishEnabled(notificationPublishEnabled);
    return new OrganizationProvisioningCompletedNotificationPlanService(appProperties);
  }
}

package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMqTopology;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 组织开通完成通知计划服务；安全门开启后 followup 可按计划投递通知队列。 */
@Service
public class OrganizationProvisioningCompletedNotificationPlanService {

  public static final String PLAN_TYPE = "organization.provisioning.completed.notification";
  public static final String TEMPLATE_KEY = "organization_provisioning_completed";

  private final AppProperties appProperties;

  public OrganizationProvisioningCompletedNotificationPlanService(AppProperties appProperties) {
    this.appProperties = appProperties;
  }

  /**
   * 生成组织开通完成后的通知计划。
   *
   * <p>本批只返回后续发送所需的幂等键、队列、渠道预案和投递安全门状态。
   * 安全门开启后仅允许投递 RabbitMQ notification 队列，不解析真实收件人、不发送短信、
   * 不投递企微或站内通知，也不刷新 Redis 缓存。
   */
  public Map<String, Object> buildPlan(
      int jobId, String targetCustomerId, String targetDbName) {
    boolean publishEnabled = appProperties.getRabbitMq().isNotificationPublishEnabled();
    Map<String, Object> plan = new LinkedHashMap<>();
    String idempotencyKey = "organization-provisioning-completed-notification:" + jobId;
    plan.put("planType", PLAN_TYPE);
    plan.put("planStatus", "preview_only");
    plan.put("jobId", jobId);
    plan.put("targetCustomerId", targetCustomerId);
    plan.put("targetDbName", targetDbName);
    plan.put("idempotencyKey", idempotencyKey);
    plan.put("templateKey", TEMPLATE_KEY);
    plan.put("notificationExchange", RabbitMqTopology.EXCHANGE_NOTIFICATION);
    plan.put("notificationQueue", RabbitMqTopology.QUEUE_NOTIFICATION);
    plan.put("notificationRoutingKey", RabbitMqTopology.ROUTING_NOTIFICATION);
    plan.put("sendEnabled", false);
    plan.put("rabbitNotificationDryRun", true);
    plan.put("rabbitNotificationPublishEnabled", publishEnabled);
    plan.put("rabbitNotificationPublishRequested", false);
    plan.put("rabbitNotificationPublishExecuted", false);
    plan.put("rabbitMessagePreviewGenerated", true);
    plan.put("redisRefreshEnabled", false);
    plan.put("recipientResolution", "deferred_to_send_batch");
    plan.put("nextExplicitSwitch", "publishOrganizationProvisioningCompletedNotification");
    plan.put("blockedReasons", blockedReasons(publishEnabled));
    plan.put(
        "rabbitMessagePreview",
        rabbitMessagePreview(jobId, targetCustomerId, targetDbName, idempotencyKey));
    plan.put("channelPlans", channelPlans(publishEnabled, idempotencyKey));
    return plan;
  }

  private List<String> blockedReasons(boolean publishEnabled) {
    if (publishEnabled) {
      return List.of("真实收件人解析和 provider 发送仍未接入，本批只投递 RabbitMQ 通知队列");
    }
    return List.of("RABBITMQ_NOTIFICATION_PUBLISH_ENABLED 未开启");
  }

  private Map<String, Object> rabbitMessagePreview(
      int jobId, String targetCustomerId, String targetDbName, String idempotencyKey) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("jobId", jobId);
    payload.put("targetCustomerId", targetCustomerId);
    payload.put("targetDbName", targetDbName);
    payload.put("templateKey", TEMPLATE_KEY);
    payload.put("channels", List.of("in_app", "wechat_work", "sms"));
    payload.put("recipientResolution", "deferred_to_notification_sender");
    payload.put("providerCallEnabled", false);

    Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("aggregateId", String.valueOf(jobId));
    preview.put("aggregateType", "tenant_provisioning_job");
    preview.put("customerId", targetCustomerId);
    preview.put(
        "headers",
        Map.of(
            "eventType",
            PLAN_TYPE,
            "source",
            "organization_provisioning_completed_followup",
            "templateKey",
            TEMPLATE_KEY));
    preview.put("idempotencyKey", idempotencyKey);
    preview.put("messageId", "organization-provisioning-completed-notification-" + jobId);
    preview.put("payload", payload);
    preview.put("routingKey", RabbitMqTopology.ROUTING_NOTIFICATION);
    preview.put("targetExchange", RabbitMqTopology.EXCHANGE_NOTIFICATION);
    preview.put("targetQueue", RabbitMqTopology.QUEUE_NOTIFICATION);
    preview.put("publishExecuted", false);
    return preview;
  }

  private List<Map<String, Object>> channelPlans(boolean publishEnabled, String idempotencyKey) {
    return List.of(
        channelPlan("in_app", "organization_admins", publishEnabled, idempotencyKey),
        channelPlan("wechat_work", "organization_admins", publishEnabled, idempotencyKey),
        channelPlan("sms", "organization_owner", publishEnabled, idempotencyKey));
  }

  private Map<String, Object> channelPlan(
      String channel, String recipientScope, boolean publishEnabled, String idempotencyKey) {
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("channel", channel);
    plan.put("idempotencyKey", idempotencyKey + ":" + channel);
    plan.put("recipientScope", recipientScope);
    plan.put("recipientResolution", "deferred");
    plan.put("templateKey", TEMPLATE_KEY);
    plan.put("sendEnabled", false);
    plan.put("publishEnabled", publishEnabled);
    plan.put("publishExecuted", false);
    plan.put("providerCallEnabled", false);
    return plan;
  }
}

package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 组织开通完成站内通知 provider 执行器前置计划；只预览写库和幂等策略。 */
@Service
public class OrganizationProvisioningCompletedInAppProviderExecutionPlanService {

  public static final String CHANNEL = "in_app";
  public static final String CONSUMER_GROUP =
      "provider-in-app-organization-provisioning-completed";
  public static final String MANUAL_DDL_FILE =
      "apps/backend-springboot/src/main/resources/db/manual/002-in-app-notification.sql";

  private final AppProperties appProperties;
  private final OrganizationProvisioningCompletedInAppProviderExecutorPreflightService
      executorPreflightService;
  private final OrganizationProvisioningCompletedInAppNotificationInsertPlanService
      notificationInsertPlanService;
  private final OrganizationProvisioningCompletedInAppDeliveryPlanService deliveryPlanService;
  private final OrganizationProvisioningCompletedInAppListenerAutoExecutionGatePlanService
      listenerAutoExecutionGatePlanService;

  public OrganizationProvisioningCompletedInAppProviderExecutionPlanService(
      AppProperties appProperties,
      OrganizationProvisioningCompletedInAppProviderExecutorPreflightService
          executorPreflightService,
      OrganizationProvisioningCompletedInAppNotificationInsertPlanService
          notificationInsertPlanService,
      OrganizationProvisioningCompletedInAppDeliveryPlanService deliveryPlanService,
      OrganizationProvisioningCompletedInAppListenerAutoExecutionGatePlanService
          listenerAutoExecutionGatePlanService) {
    this.appProperties = appProperties;
    this.executorPreflightService = executorPreflightService;
    this.notificationInsertPlanService = notificationInsertPlanService;
    this.deliveryPlanService = deliveryPlanService;
    this.listenerAutoExecutionGatePlanService = listenerAutoExecutionGatePlanService;
  }

  /**
   * 根据 provider 计划生成站内通知写库预案。
   *
   * <p>本方法不访问数据库，不写 `event_consume_log`，不写站内通知表，也不调用短信或企微 provider。
   */
  public Map<String, Object> buildPlan(Map<String, Object> providerPlan) {
    Map<String, Object> channelPlan = channelPlan(providerPlan);
    List<Map<String, Object>> recipients = recipients(channelPlan);
    String eventId = stringValue(providerPlan.get("eventId"));
    String idempotencyKey = stringValue(channelPlan.get("idempotencyKey"));
    List<String> blockedReasons =
        blockedReasons(providerPlan, channelPlan, recipients, eventId, idempotencyKey);
    boolean ready = blockedReasons.isEmpty();

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", "organization.provisioning.completed.notification.in_app.execution");
    plan.put("planStatus", ready ? "ready_for_write_plan" : "blocked");
    plan.put("channel", CHANNEL);
    plan.put("executorBean", "organizationProvisioningCompletedInAppProviderExecutor");
    plan.put(
        "manualExecutionBean",
        "organizationProvisioningCompletedInAppProviderManualExecutionService");
    plan.put("jobId", providerPlan.get("jobId"));
    plan.put("targetCustomerId", providerPlan.get("targetCustomerId"));
    plan.put("targetDbName", providerPlan.get("targetDbName"));
    plan.put("eventId", eventId);
    plan.put("idempotencyKey", idempotencyKey);
    plan.put("providerSendEnabled", booleanValue(providerPlan.get("providerSendEnabled")));
    plan.put("providerChannelGuard", stringValue(providerPlan.get("providerChannelGuard")));
    plan.put("recipientCount", recipients.size());
    plan.put("executionRequested", false);
    plan.put("executionExecuted", false);
    plan.put("manualExecutionRequested", false);
    plan.put("manualExecutionExecuted", false);
    plan.put("manualFailureClosureSupported", true);
    plan.put("manualFailureClosureExecuted", false);
    plan.put("listenerAutoExecution", false);
    plan.put("websocketExecuted", false);
    plan.put("pushExecuted", false);
    plan.put("websocketPushDeliveryPlanned", true);
    plan.put("websocketPushDeliveryExecuted", false);
    plan.put("dbWriteExecuted", false);
    plan.put("smsProviderExecuted", false);
    plan.put("weworkProviderExecuted", false);
    plan.put(
        "executionBoundary",
        "第 173 批后显式手动入口可串联 claim/insert/markSuccess，insert/markSuccess 异常可按安全门 markFailure；仍不接 listener");
    plan.put("blockedReasons", blockedReasons);
    Map<String, Object> writePreview = writePreview(providerPlan, channelPlan, recipients, eventId);
    Map<String, Object> notificationInsertPlan =
        notificationInsertPlanService.buildPlan(plan, writePreview);
    writePreview.put("notificationInsertPlan", notificationInsertPlan);
    writePreview.put(
        "websocketPushDeliveryPlan",
        deliveryPlanService.buildPlan(plan, writePreview, notificationInsertPlan));
    plan.put("writePreview", writePreview);
    plan.put("executorPreflightPlan", executorPreflightService.buildPreflight(plan));
    plan.put(
        "listenerAutoExecutionGatePlan",
        listenerAutoExecutionGatePlanService.buildPlan(plan));
    plan.put("nextAction", nextAction(ready));
    return plan;
  }

  private Map<String, Object> writePreview(
      Map<String, Object> providerPlan,
      Map<String, Object> channelPlan,
      List<Map<String, Object>> recipients,
      String eventId) {
    Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("idempotencyTable", "event_consume_log");
    preview.put("idempotencyConsumerGroup", CONSUMER_GROUP);
    preview.put("idempotencyEventId", eventIdForChannel(eventId));
    preview.put("idempotencyKey", stringValue(channelPlan.get("idempotencyKey")));
    preview.put("notificationTable", "in_app_notification");
    preview.put("manualDdlFile", MANUAL_DDL_FILE);
    preview.put("notificationTableCreated", manualDdlApplied());
    preview.put("manualDdlApplied", manualDdlApplied());
    preview.put("manualDdlRequired", !manualDdlApplied());
    preview.put("writeStrategy", "claim_event_consume_log_then_insert_one_row_per_recipient");
    preview.put("statusAfterWrite", "unread");
    preview.put("templateKey", providerPlan.get("templateKey"));
    preview.put("recipientWritePreviews", recipientWritePreviews(channelPlan, recipients));
    preview.put(
        "deferredSideEffects",
        List.of(
            "event_consume_log_claim",
            "in_app_notification_insert",
            "event_consume_log_mark_success",
            "websocket_or_push_delivery"));
    return preview;
  }

  private List<Map<String, Object>> recipientWritePreviews(
      Map<String, Object> channelPlan, List<Map<String, Object>> recipients) {
    List<Map<String, Object>> previews = new ArrayList<>();
    String baseIdempotencyKey = stringValue(channelPlan.get("idempotencyKey"));
    for (Map<String, Object> recipient : recipients) {
      Map<String, Object> preview = new LinkedHashMap<>();
      Object centerUserId = recipient.get("centerUserId");
      preview.put("centerUserId", centerUserId);
      preview.put("targetCustomerId", recipient.get("targetCustomerId"));
      preview.put("targetDbName", recipient.get("targetDbName"));
      preview.put("recipientScope", recipient.get("recipientScope"));
      preview.put("memberRole", recipient.get("memberRole"));
      preview.put("title", "组织空间开通完成");
      preview.put("contentTemplate", "您的组织空间已开通完成，请刷新后进入新空间。");
      preview.put("status", "unread");
      preview.put("idempotencyKey", baseIdempotencyKey + ":" + centerUserId);
      preview.put("writeExecuted", false);
      previews.add(preview);
    }
    return previews;
  }

  private List<String> blockedReasons(
      Map<String, Object> providerPlan,
      Map<String, Object> channelPlan,
      List<Map<String, Object>> recipients,
      String eventId,
      String idempotencyKey) {
    List<String> reasons = new ArrayList<>();
    if (channelPlan.isEmpty()) {
      reasons.add("providerPlan 缺少 in_app channelPlan");
    }
    if (!readyChannels(providerPlan).contains(CHANNEL)) {
      reasons.add("in_app 未进入 providerReadyChannels，不能进入写库执行预案");
    }
    if (recipients.isEmpty()) {
      reasons.add("in_app 没有可写入站内通知的收件人");
    }
    if (!StringUtils.hasText(eventId)) {
      reasons.add("providerPlan 缺少 eventId");
    }
    if (!StringUtils.hasText(idempotencyKey)) {
      reasons.add("in_app channelPlan 缺少 idempotencyKey");
    }
    return reasons.stream().filter(StringUtils::hasText).distinct().toList();
  }

  private String nextAction(boolean ready) {
    if (ready) {
      return "ready_for_in_app_provider_executor_claim_preflight_but_current_plan_does_not_write";
    }
    return "fix_in_app_execution_plan_blockers_before_write_batch";
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> channelPlan(Map<String, Object> providerPlan) {
    Object value = providerPlan.get("channelPlans");
    if (!(value instanceof List<?> plans)) {
      return Map.of();
    }
    for (Object plan : plans) {
      if (plan instanceof Map<?, ?> map && CHANNEL.equals(stringValue(map.get("channel")))) {
        return (Map<String, Object>) map;
      }
    }
    return Map.of();
  }

  private List<Map<String, Object>> recipients(Map<String, Object> channelPlan) {
    Object value = channelPlan.get("recipients");
    if (!(value instanceof List<?> items)) {
      return List.of();
    }
    List<Map<String, Object>> recipients = new ArrayList<>();
    for (Object item : items) {
      if (item instanceof Map<?, ?> map) {
        Map<String, Object> recipient = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
          recipient.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        recipients.add(recipient);
      }
    }
    return recipients;
  }

  private List<String> readyChannels(Map<String, Object> providerPlan) {
    Object value = providerPlan.get("providerReadyChannels");
    if (!(value instanceof List<?> channels)) {
      return List.of();
    }
    return channels.stream().map(this::stringValue).filter(StringUtils::hasText).toList();
  }

  private String eventIdForChannel(String eventId) {
    if (!StringUtils.hasText(eventId)) {
      return "";
    }
    return eventId + ":" + CHANNEL;
  }

  private boolean manualDdlApplied() {
    return appProperties.getRabbitMq().isOrganizationProvisioningInAppNotificationDdlApplied();
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

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

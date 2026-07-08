package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.messaging.rabbit.RabbitMqTopology;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 组织开通完成站内通知执行器认领预检；只生成 claim 参数，不调用仓储或写业务表。 */
@Service
public class OrganizationProvisioningCompletedInAppProviderExecutorPreflightService {

  public static final String EVENT_TYPE =
      "provider.organization.provisioning.completed.in_app_notification";

  /**
   * 生成站内通知 provider 执行器的 claim dry-run 计划。
   *
   * <p>本方法不调用 `EventConsumeLogRepository.claimProcessing(...)`，不写
   * `event_consume_log`，不插入 `in_app_notification`，也不触发 websocket/push。
   */
  public Map<String, Object> buildPreflight(Map<String, Object> executionPlan) {
    Map<String, Object> writePreview = mapValue(executionPlan.get("writePreview"));
    List<Map<String, Object>> recipientWritePreviews =
        mapList(writePreview.get("recipientWritePreviews"));
    String eventId = stringValue(writePreview.get("idempotencyEventId"));
    String idempotencyKey = stringValue(writePreview.get("idempotencyKey"));
    String consumerGroup =
        defaultString(
            writePreview.get("idempotencyConsumerGroup"),
            OrganizationProvisioningCompletedInAppProviderExecutionPlanService.CONSUMER_GROUP);
    boolean manualDdlApplied = Boolean.TRUE.equals(writePreview.get("manualDdlApplied"));
    List<String> blockedReasons =
        blockedReasons(
            executionPlan,
            writePreview,
            recipientWritePreviews,
            eventId,
            idempotencyKey,
            manualDdlApplied);
    boolean claimReady = blockedReasons.isEmpty();

    Map<String, Object> preflight = new LinkedHashMap<>();
    preflight.put(
        "planType",
        "organization.provisioning.completed.notification.in_app.executor.preflight");
    preflight.put("planStatus", claimReady ? "ready_for_claim_dry_run" : "blocked");
    preflight.put("channel", OrganizationProvisioningCompletedInAppProviderExecutionPlanService.CHANNEL);
    preflight.put("executorBean", executionPlan.get("executorBean"));
    preflight.put("eventId", eventId);
    preflight.put("idempotencyKey", idempotencyKey);
    preflight.put("consumerGroup", consumerGroup);
    preflight.put("eventType", EVENT_TYPE);
    preflight.put("topic", RabbitMqTopology.QUEUE_NOTIFICATION);
    preflight.put("recipientWritePreviewCount", recipientWritePreviews.size());
    preflight.put(
        "manualDdlFile",
        OrganizationProvisioningCompletedInAppProviderExecutionPlanService.MANUAL_DDL_FILE);
    preflight.put("manualDdlApplied", manualDdlApplied);
    preflight.put("claimReady", claimReady);
    preflight.put("claimRequested", false);
    preflight.put("claimExecuted", false);
    preflight.put("dbWriteExecuted", false);
    preflight.put("markSuccessExecuted", false);
    preflight.put("markFailureExecuted", false);
    preflight.put("executionBoundary", "第 166 批只生成 claim 预检，不调用仓储、不写站内通知");
    preflight.put(
        "eventConsumeLogEntryPreview",
        eventConsumeLogEntryPreview(consumerGroup, eventId, idempotencyKey));
    preflight.put(
        "claimStrategy",
        "EventConsumeLogRepository.claimProcessing -> insert in_app_notification rows -> markSuccess/markFailure");
    preflight.put(
        "claimResultHandling",
        Map.of(
            "CLAIMED",
            "continue_to_in_app_notification_insert_in_future_batch",
            "DUPLICATE_SUCCESS",
            "return_duplicate_without_insert",
            "IN_PROGRESS",
            "return_already_processing_without_insert"));
    preflight.put(
        "transactionBoundary",
        List.of(
            "claim event_consume_log",
            "insert one in_app_notification row per recipient idempotencyKey",
            "mark event_consume_log success after all rows are inserted",
            "mark event_consume_log failed when insert throws"));
    preflight.put("blockedReasons", blockedReasons);
    preflight.put("nextAction", nextAction(claimReady));
    return preflight;
  }

  private Map<String, Object> eventConsumeLogEntryPreview(
      String consumerGroup, String eventId, String idempotencyKey) {
    Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("type", "EventConsumeLogEntry");
    preview.put("consumerGroup", consumerGroup);
    preview.put("eventId", eventId);
    preview.put("eventType", EVENT_TYPE);
    preview.put("idempotencyKey", idempotencyKey);
    preview.put("topic", RabbitMqTopology.QUEUE_NOTIFICATION);
    preview.put("claimMethod", "EventConsumeLogRepository.claimProcessing");
    preview.put("claimExecuted", false);
    return preview;
  }

  private List<String> blockedReasons(
      Map<String, Object> executionPlan,
      Map<String, Object> writePreview,
      List<Map<String, Object>> recipientWritePreviews,
      String eventId,
      String idempotencyKey,
      boolean manualDdlApplied) {
    List<String> reasons = new ArrayList<>();
    if (!"ready_for_write_plan".equals(stringValue(executionPlan.get("planStatus")))) {
      reasons.add("in_app executionPlan 尚未 ready_for_write_plan");
    }
    if (writePreview.isEmpty()) {
      reasons.add("缺少 writePreview，不能生成 claim 参数");
    }
    if (!manualDdlApplied) {
      reasons.add("in_app_notification 手工 DDL 尚未确认应用");
    }
    if (!StringUtils.hasText(eventId)) {
      reasons.add("缺少 provider in_app 幂等 eventId");
    }
    if (!StringUtils.hasText(idempotencyKey)) {
      reasons.add("缺少 provider in_app 幂等 idempotencyKey");
    }
    if (recipientWritePreviews.isEmpty()) {
      reasons.add("缺少站内通知收件人写入预览");
    }
    if (recipientWritePreviews.stream().anyMatch(this::recipientPreviewInvalid)) {
      reasons.add("recipientWritePreviews 存在缺少 centerUserId 或 idempotencyKey 的行");
    }
    return reasons.stream().filter(StringUtils::hasText).distinct().toList();
  }

  private boolean recipientPreviewInvalid(Map<String, Object> recipientPreview) {
    return !StringUtils.hasText(stringValue(recipientPreview.get("centerUserId")))
        || !StringUtils.hasText(stringValue(recipientPreview.get("idempotencyKey")));
  }

  private String nextAction(boolean claimReady) {
    if (claimReady) {
      return "ready_for_real_event_consume_log_claim_batch_but_current_preflight_does_not_claim";
    }
    return "apply_in_app_notification_manual_ddl_and_fix_blockers_before_claim_batch";
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> mapValue(Object value) {
    if (!(value instanceof Map<?, ?> map)) {
      return Map.of();
    }
    Map<String, Object> result = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      result.put(String.valueOf(entry.getKey()), entry.getValue());
    }
    return result;
  }

  private List<Map<String, Object>> mapList(Object value) {
    if (!(value instanceof List<?> values)) {
      return List.of();
    }
    List<Map<String, Object>> result = new ArrayList<>();
    for (Object item : values) {
      if (item instanceof Map<?, ?> map) {
        Map<String, Object> row = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
          row.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        result.add(row);
      }
    }
    return result;
  }

  private String defaultString(Object value, String fallback) {
    String text = stringValue(value);
    return StringUtils.hasText(text) ? text : fallback;
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

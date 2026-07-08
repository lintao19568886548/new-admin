package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 站内通知逐收件人 insert 参数预检；只生成参数，不执行 SQL。 */
@Service
public class OrganizationProvisioningCompletedInAppNotificationInsertPlanService {

  private static final List<String> INSERT_COLUMNS =
      List.of(
          "event_id",
          "idempotency_key",
          "recipient_center_user_id",
          "target_customer_id",
          "target_db_name",
          "template_key",
          "title",
          "content",
          "status",
          "payload_json");

  /**
   * 生成 `in_app_notification` 单表 insert 参数预览。
   *
   * <p>本方法不持有 `JdbcTemplate`，不执行 insert，也不更新 `event_consume_log`。
   */
  public Map<String, Object> buildPlan(
      Map<String, Object> executionPlan, Map<String, Object> writePreview) {
    List<Map<String, Object>> recipientPreviews =
        mapList(writePreview.get("recipientWritePreviews"));
    List<Map<String, Object>> rows = insertRows(executionPlan, writePreview, recipientPreviews);
    List<String> blockedReasons = blockedReasons(executionPlan, writePreview, rows);
    boolean ready = blockedReasons.isEmpty();

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "organization.provisioning.completed.notification.in_app.notification_insert");
    plan.put("planStatus", ready ? "ready_for_insert_dry_run" : "blocked");
    plan.put("tableName", "in_app_notification");
    plan.put("insertColumns", INSERT_COLUMNS);
    plan.put("insertRowCount", rows.size());
    plan.put("manualDdlApplied", Boolean.TRUE.equals(writePreview.get("manualDdlApplied")));
    plan.put("insertRequested", false);
    plan.put("insertExecuted", false);
    plan.put("dbWriteExecuted", false);
    plan.put("executionBoundary", "第 168 批只生成 in_app_notification insert 参数预检，不执行 SQL");
    plan.put("insertRows", rows);
    plan.put("blockedReasons", blockedReasons);
    plan.put("nextAction", nextAction(ready));
    return plan;
  }

  private List<Map<String, Object>> insertRows(
      Map<String, Object> executionPlan,
      Map<String, Object> writePreview,
      List<Map<String, Object>> recipientPreviews) {
    List<Map<String, Object>> rows = new ArrayList<>();
    String eventId = stringValue(writePreview.get("idempotencyEventId"));
    String templateKey = stringValue(writePreview.get("templateKey"));
    String targetCustomerId = stringValue(executionPlan.get("targetCustomerId"));
    String targetDbName = stringValue(executionPlan.get("targetDbName"));
    for (Map<String, Object> recipientPreview : recipientPreviews) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("eventId", eventId);
      row.put("idempotencyKey", recipientPreview.get("idempotencyKey"));
      row.put("recipientCenterUserId", recipientPreview.get("centerUserId"));
      row.put(
          "targetCustomerId",
          defaultString(recipientPreview.get("targetCustomerId"), targetCustomerId));
      row.put("targetDbName", defaultString(recipientPreview.get("targetDbName"), targetDbName));
      row.put("templateKey", templateKey);
      row.put("title", recipientPreview.get("title"));
      row.put("content", recipientPreview.get("contentTemplate"));
      row.put("status", defaultString(recipientPreview.get("status"), "unread"));
      row.put(
          "payloadJsonPreview",
          payloadJsonPreview(executionPlan, recipientPreview));
      row.put("insertExecuted", false);
      rows.add(row);
    }
    return rows;
  }

  private Map<String, Object> payloadJsonPreview(
      Map<String, Object> executionPlan, Map<String, Object> recipientPreview) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("jobId", executionPlan.get("jobId"));
    payload.put("recipientScope", recipientPreview.get("recipientScope"));
    payload.put("memberRole", recipientPreview.get("memberRole"));
    payload.put("channel", OrganizationProvisioningCompletedInAppProviderExecutionPlanService.CHANNEL);
    return payload;
  }

  private List<String> blockedReasons(
      Map<String, Object> executionPlan, Map<String, Object> writePreview, List<Map<String, Object>> rows) {
    List<String> reasons = new ArrayList<>();
    if (!"ready_for_write_plan".equals(stringValue(executionPlan.get("planStatus")))) {
      reasons.add("in_app executionPlan 尚未 ready_for_write_plan");
    }
    if (!Boolean.TRUE.equals(writePreview.get("manualDdlApplied"))) {
      reasons.add("in_app_notification 手工 DDL 尚未确认应用");
    }
    if (rows.isEmpty()) {
      reasons.add("缺少可预检的站内通知 insert 行");
    }
    for (Map<String, Object> row : rows) {
      reasons.addAll(rowBlockedReasons(row));
    }
    return reasons.stream().filter(StringUtils::hasText).distinct().toList();
  }

  private List<String> rowBlockedReasons(Map<String, Object> row) {
    List<String> reasons = new ArrayList<>();
    if (!StringUtils.hasText(stringValue(row.get("eventId")))) {
      reasons.add("insert 行缺少 eventId");
    }
    if (!StringUtils.hasText(stringValue(row.get("idempotencyKey")))) {
      reasons.add("insert 行缺少 idempotencyKey");
    }
    if (!StringUtils.hasText(stringValue(row.get("recipientCenterUserId")))) {
      reasons.add("insert 行缺少 recipientCenterUserId");
    }
    if (!StringUtils.hasText(stringValue(row.get("targetCustomerId")))) {
      reasons.add("insert 行缺少 targetCustomerId");
    }
    if (!StringUtils.hasText(stringValue(row.get("targetDbName")))) {
      reasons.add("insert 行缺少 targetDbName");
    }
    if (!StringUtils.hasText(stringValue(row.get("templateKey")))) {
      reasons.add("insert 行缺少 templateKey");
    }
    if (!StringUtils.hasText(stringValue(row.get("title")))) {
      reasons.add("insert 行缺少 title");
    }
    if (!StringUtils.hasText(stringValue(row.get("content")))) {
      reasons.add("insert 行缺少 content");
    }
    if (!StringUtils.hasText(stringValue(row.get("status")))) {
      reasons.add("insert 行缺少 status");
    }
    return reasons;
  }

  private String nextAction(boolean ready) {
    if (ready) {
      return "ready_for_in_app_notification_insert_repository_batch_but_current_plan_does_not_insert";
    }
    return "fix_in_app_notification_insert_plan_blockers_before_repository_batch";
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

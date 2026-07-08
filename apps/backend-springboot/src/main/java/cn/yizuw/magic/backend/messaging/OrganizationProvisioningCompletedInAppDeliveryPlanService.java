package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 站内通知 websocket/push 投递预案；只生成 dry-run 明细，不执行真实推送。 */
@Service
public class OrganizationProvisioningCompletedInAppDeliveryPlanService {

  /**
   * 生成站内通知后续投递 dry-run 计划。
   *
   * <p>本方法只根据 insert 预案和收件人预览生成 websocket/push 候选消息，不创建连接、不投递 MQ、
   * 不调用外部推送服务。
   */
  public Map<String, Object> buildPlan(
      Map<String, Object> executionPlan,
      Map<String, Object> writePreview,
      Map<String, Object> notificationInsertPlan) {
    List<Map<String, Object>> insertRows = mapList(notificationInsertPlan.get("insertRows"));
    List<Map<String, Object>> recipientPreviews =
        mapList(writePreview.get("recipientWritePreviews"));
    List<Map<String, Object>> deliveries =
        deliveryRows(executionPlan, insertRows, recipientPreviews);
    List<String> blockedReasons =
        blockedReasons(executionPlan, notificationInsertPlan, deliveries);
    boolean ready = blockedReasons.isEmpty();

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "organization.provisioning.completed.notification.in_app.websocket_push_delivery");
    plan.put("planStatus", ready ? "ready_for_delivery_dry_run" : "blocked");
    plan.put("deliveryChannels", List.of("websocket", "push"));
    plan.put("deliveryRowCount", deliveries.size());
    plan.put("websocketRequested", false);
    plan.put("websocketExecuted", false);
    plan.put("pushRequested", false);
    plan.put("pushExecuted", false);
    plan.put("deliveryExecuted", false);
    plan.put("dbWriteExecuted", false);
    plan.put("executionBoundary", "第 174 批只生成 websocket/push 投递 dry-run 计划，不执行真实推送");
    plan.put("deliveryRows", deliveries);
    plan.put("blockedReasons", blockedReasons);
    plan.put("nextAction", nextAction(ready));
    return plan;
  }

  private List<Map<String, Object>> deliveryRows(
      Map<String, Object> executionPlan,
      List<Map<String, Object>> insertRows,
      List<Map<String, Object>> recipientPreviews) {
    List<Map<String, Object>> rows = new ArrayList<>();
    for (Map<String, Object> insertRow : insertRows) {
      Map<String, Object> recipient =
          recipientPreview(recipientPreviews, insertRow.get("recipientCenterUserId"));
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("recipientCenterUserId", insertRow.get("recipientCenterUserId"));
      row.put(
          "targetCustomerId",
          defaultString(insertRow.get("targetCustomerId"), executionPlan.get("targetCustomerId")));
      row.put(
          "targetDbName",
          defaultString(insertRow.get("targetDbName"), executionPlan.get("targetDbName")));
      row.put("eventId", insertRow.get("eventId"));
      row.put("notificationIdempotencyKey", insertRow.get("idempotencyKey"));
      row.put("templateKey", insertRow.get("templateKey"));
      row.put("title", insertRow.get("title"));
      row.put("content", insertRow.get("content"));
      row.put("recipientScope", recipient.get("recipientScope"));
      row.put("memberRole", recipient.get("memberRole"));
      row.put(
          "websocketTopic",
          "user:" + stringValue(insertRow.get("recipientCenterUserId")) + ":notifications");
      row.put("websocketEvent", "in_app_notification.created");
      row.put("pushTemplateKey", "organization_provisioning_completed_in_app");
      row.put("websocketExecuted", false);
      row.put("pushExecuted", false);
      rows.add(row);
    }
    return rows;
  }

  private List<String> blockedReasons(
      Map<String, Object> executionPlan,
      Map<String, Object> notificationInsertPlan,
      List<Map<String, Object>> deliveries) {
    List<String> reasons = new ArrayList<>();
    if (!"ready_for_write_plan".equals(stringValue(executionPlan.get("planStatus")))) {
      reasons.add("in_app executionPlan 尚未 ready_for_write_plan");
    }
    if (!"ready_for_insert_dry_run".equals(stringValue(notificationInsertPlan.get("planStatus")))) {
      reasons.add("notificationInsertPlan 尚未 ready_for_insert_dry_run");
    }
    if (deliveries.isEmpty()) {
      reasons.add("缺少可预检的 websocket/push 投递行");
    }
    for (Map<String, Object> row : deliveries) {
      reasons.addAll(rowBlockedReasons(row));
    }
    return reasons.stream().filter(StringUtils::hasText).distinct().toList();
  }

  private List<String> rowBlockedReasons(Map<String, Object> row) {
    List<String> reasons = new ArrayList<>();
    if (!StringUtils.hasText(stringValue(row.get("recipientCenterUserId")))) {
      reasons.add("投递行缺少 recipientCenterUserId");
    }
    if (!StringUtils.hasText(stringValue(row.get("notificationIdempotencyKey")))) {
      reasons.add("投递行缺少 notificationIdempotencyKey");
    }
    if (!StringUtils.hasText(stringValue(row.get("websocketTopic")))) {
      reasons.add("投递行缺少 websocketTopic");
    }
    if (!StringUtils.hasText(stringValue(row.get("title")))) {
      reasons.add("投递行缺少 title");
    }
    if (!StringUtils.hasText(stringValue(row.get("content")))) {
      reasons.add("投递行缺少 content");
    }
    return reasons;
  }

  private String nextAction(boolean ready) {
    if (ready) {
      return "ready_for_websocket_push_provider_batch_but_current_plan_does_not_deliver";
    }
    return "fix_websocket_push_delivery_plan_blockers_before_provider_batch";
  }

  private Map<String, Object> recipientPreview(
      List<Map<String, Object>> recipientPreviews, Object centerUserId) {
    String expected = stringValue(centerUserId);
    for (Map<String, Object> recipient : recipientPreviews) {
      if (expected.equals(stringValue(recipient.get("centerUserId")))) {
        return recipient;
      }
    }
    return Map.of();
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

  private String defaultString(Object value, Object fallback) {
    String text = stringValue(value);
    return StringUtils.hasText(text) ? text : stringValue(fallback);
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

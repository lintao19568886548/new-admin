package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.config.AppProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 组织开通完成站内通知 provider 执行器。
 *
 * <p>provider 消费日志认领、站内通知写入和成功收口都由独立安全门控制；当前仍不触发
 * websocket/push。
 */
@Service
public class OrganizationProvisioningCompletedInAppProviderExecutor {

  private static final ObjectMapper JSON = new ObjectMapper();

  private final AppProperties appProperties;
  private final EventConsumeLogRepository eventConsumeLogRepository;
  private final OrganizationProvisioningCompletedInAppNotificationRepository
      notificationRepository;

  public OrganizationProvisioningCompletedInAppProviderExecutor(
      AppProperties appProperties,
      EventConsumeLogRepository eventConsumeLogRepository,
      OrganizationProvisioningCompletedInAppNotificationRepository notificationRepository) {
    this.appProperties = appProperties;
    this.eventConsumeLogRepository = eventConsumeLogRepository;
    this.notificationRepository = notificationRepository;
  }

  /**
   * 按预检计划真实认领 provider 消费权。
   *
   * <p>调用方必须传入第 166 批生成的 `executorPreflightPlan`。本方法即使认领成功，也只返回
   * `claimed_write_deferred`，业务表写入需要显式调用 `insertNotifications(...)`。
   */
  public OrganizationProvisioningCompletedInAppProviderClaimResult claim(
      Map<String, Object> preflightPlan) {
    List<String> blockedReasons = stringList(preflightPlan.get("blockedReasons"));
    if (!blockedReasons.isEmpty() || !Boolean.TRUE.equals(preflightPlan.get("claimReady"))) {
      return result(false, false, false, false, null, "preflight_blocked", "blocked", preflightPlan);
    }
    if (!appProperties.getRabbitMq().isOrganizationProvisioningInAppProviderClaimEnabled()) {
      return result(
          false,
          false,
          false,
          false,
          null,
          "claim_gate_disabled",
          "dry_run",
          preflightPlan);
    }

    EventConsumeLogEntry entry = entry(preflightPlan);
    EventConsumeClaimResult claimResult = eventConsumeLogRepository.claimProcessing(entry);
    if (claimResult == EventConsumeClaimResult.CLAIMED) {
      return result(
          true,
          false,
          true,
          true,
          claimResult,
          "claimed_write_deferred",
          "processing",
          preflightPlan);
    }
    return result(
        false,
        true,
        true,
        false,
        claimResult,
        claimResult == EventConsumeClaimResult.IN_PROGRESS ? "already_processing" : "already_consumed",
        "duplicate",
        preflightPlan);
  }

  /**
   * 写入站内通知业务表。
   *
   * <p>第 169 批只执行 `in_app_notification` 单表 insert；即使写入成功，也不调用
   * `event_consume_log.markSuccess(...)`，该收口由 `markSuccess(...)` 独立控制。
   */
  public OrganizationProvisioningCompletedInAppNotificationInsertResult insertNotifications(
      OrganizationProvisioningCompletedInAppProviderClaimResult claimResult,
      Map<String, Object> notificationInsertPlan) {
    Map<String, Object> plan = notificationInsertPlan == null ? Map.of() : notificationInsertPlan;
    if (claimResult == null || !claimResult.accepted()) {
      return insertResult(
          false,
          false,
          false,
          false,
          0,
          0,
          0,
          "claim_not_accepted",
          "blocked",
          plan);
    }
    List<String> blockedReasons = stringList(plan.get("blockedReasons"));
    if (!blockedReasons.isEmpty()
        || !"ready_for_insert_dry_run".equals(stringValue(plan.get("planStatus")))) {
      return insertResult(
          false,
          false,
          false,
          false,
          0,
          0,
          0,
          "insert_plan_blocked",
          "blocked",
          plan);
    }
    if (!appProperties.getRabbitMq().isOrganizationProvisioningInAppNotificationInsertEnabled()) {
      return insertResult(
          false,
          false,
          false,
          false,
          rowMaps(plan).size(),
          0,
          0,
          "insert_gate_disabled",
          "dry_run",
          plan);
    }

    List<OrganizationProvisioningCompletedInAppNotificationInsertRow> rows =
        insertRows(plan);
    OrganizationProvisioningCompletedInAppNotificationRepositoryResult repositoryResult =
        notificationRepository.insertRows(rows);
    boolean allDuplicate =
        repositoryResult.requestedRows() > 0 && repositoryResult.insertedRows() == 0;
    return insertResult(
        true,
        allDuplicate,
        true,
        true,
        repositoryResult.requestedRows(),
        repositoryResult.insertedRows(),
        repositoryResult.duplicateRows(),
        allDuplicate ? "already_inserted" : "inserted_mark_success_deferred",
        allDuplicate ? "duplicate" : "inserted",
        plan);
  }

  /**
   * 将 provider 消费日志标记为成功。
   *
   * <p>第 170 批只收口 `event_consume_log.status=success`；不会推送 websocket，也不会调用外部
   * 短信/企微 provider。
   */
  public OrganizationProvisioningCompletedInAppProviderMarkSuccessResult markSuccess(
      OrganizationProvisioningCompletedInAppProviderClaimResult claimResult,
      OrganizationProvisioningCompletedInAppNotificationInsertResult insertResult) {
    Map<String, Object> preflightPlan =
        claimResult == null || claimResult.preflightPlan() == null
            ? Map.of()
            : claimResult.preflightPlan();
    if (claimResult == null || !claimResult.accepted()) {
      return markSuccessResult(
          false, false, false, "claim_not_accepted", "blocked", preflightPlan);
    }
    if (insertResult == null || !insertResult.accepted()) {
      return markSuccessResult(
          false, false, false, "insert_not_accepted", "blocked", preflightPlan);
    }
    if (!appProperties.getRabbitMq().isOrganizationProvisioningInAppProviderMarkSuccessEnabled()) {
      return markSuccessResult(
          false, false, false, "mark_success_gate_disabled", "dry_run", preflightPlan);
    }

    eventConsumeLogRepository.markSuccess(entry(preflightPlan));
    return markSuccessResult(
        true,
        true,
        true,
        "provider_consume_log_marked_success",
        "success",
        preflightPlan);
  }

  /**
   * 将 provider 消费日志标记为失败。
   *
   * <p>第 172 批只提供显式失败收口能力；调用方必须先完成 provider claim。本方法不做重试投递，
   * 不触发 websocket/push，也不接入 RabbitMQ listener。
   */
  public OrganizationProvisioningCompletedInAppProviderMarkFailureResult markFailure(
      OrganizationProvisioningCompletedInAppProviderClaimResult claimResult,
      String failureReason) {
    Map<String, Object> preflightPlan =
        claimResult == null || claimResult.preflightPlan() == null
            ? Map.of()
            : claimResult.preflightPlan();
    if (claimResult == null || !claimResult.accepted()) {
      return markFailureResult(
          false,
          false,
          false,
          failureReason,
          "claim_not_accepted",
          "blocked",
          preflightPlan);
    }
    String normalizedFailureReason = stringValue(failureReason).trim();
    if (!StringUtils.hasText(normalizedFailureReason)) {
      return markFailureResult(
          false,
          false,
          false,
          failureReason,
          "failure_reason_missing",
          "blocked",
          preflightPlan);
    }
    if (!appProperties.getRabbitMq().isOrganizationProvisioningInAppProviderMarkFailureEnabled()) {
      return markFailureResult(
          false,
          false,
          false,
          normalizedFailureReason,
          "mark_failure_gate_disabled",
          "dry_run",
          preflightPlan);
    }

    eventConsumeLogRepository.markFailure(entry(preflightPlan), normalizedFailureReason);
    return markFailureResult(
        true,
        true,
        true,
        normalizedFailureReason,
        "provider_consume_log_marked_failed",
        "failed",
        preflightPlan);
  }

  private EventConsumeLogEntry entry(Map<String, Object> preflightPlan) {
    return new EventConsumeLogEntry(
        requiredText(preflightPlan.get("consumerGroup"), "consumerGroup"),
        requiredText(preflightPlan.get("eventId"), "eventId"),
        requiredText(preflightPlan.get("eventType"), "eventType"),
        requiredText(preflightPlan.get("idempotencyKey"), "idempotencyKey"),
        requiredText(preflightPlan.get("topic"), "topic"));
  }

  private OrganizationProvisioningCompletedInAppProviderClaimResult result(
      boolean accepted,
      boolean duplicate,
      boolean claimAttempted,
      boolean claimExecuted,
      EventConsumeClaimResult claimResult,
      String reason,
      String status,
      Map<String, Object> preflightPlan) {
    return new OrganizationProvisioningCompletedInAppProviderClaimResult(
        accepted,
        duplicate,
        claimAttempted,
        claimExecuted,
        false,
        false,
        false,
        claimResult,
        reason,
        status,
        preflightPlan);
  }

  private OrganizationProvisioningCompletedInAppNotificationInsertResult insertResult(
      boolean accepted,
      boolean duplicate,
      boolean insertAttempted,
      boolean insertExecuted,
      int requestedRows,
      int insertedRows,
      int duplicateRows,
      String reason,
      String status,
      Map<String, Object> notificationInsertPlan) {
    return new OrganizationProvisioningCompletedInAppNotificationInsertResult(
        accepted,
        duplicate,
        insertAttempted,
        insertExecuted,
        insertExecuted,
        false,
        false,
        requestedRows,
        insertedRows,
        duplicateRows,
        reason,
        status,
        notificationInsertPlan);
  }

  private OrganizationProvisioningCompletedInAppProviderMarkSuccessResult markSuccessResult(
      boolean accepted,
      boolean markSuccessAttempted,
      boolean markSuccessExecuted,
      String reason,
      String status,
      Map<String, Object> preflightPlan) {
    return new OrganizationProvisioningCompletedInAppProviderMarkSuccessResult(
        accepted,
        markSuccessAttempted,
        markSuccessExecuted,
        markSuccessExecuted,
        false,
        false,
        reason,
        status,
        preflightPlan);
  }

  private OrganizationProvisioningCompletedInAppProviderMarkFailureResult markFailureResult(
      boolean accepted,
      boolean markFailureAttempted,
      boolean markFailureExecuted,
      String failureReason,
      String reason,
      String status,
      Map<String, Object> preflightPlan) {
    return new OrganizationProvisioningCompletedInAppProviderMarkFailureResult(
        accepted,
        markFailureAttempted,
        markFailureExecuted,
        markFailureExecuted,
        false,
        false,
        failureReason,
        reason,
        status,
        preflightPlan);
  }

  private List<OrganizationProvisioningCompletedInAppNotificationInsertRow> insertRows(
      Map<String, Object> notificationInsertPlan) {
    List<OrganizationProvisioningCompletedInAppNotificationInsertRow> rows = new ArrayList<>();
    for (Map<String, Object> row : rowMaps(notificationInsertPlan)) {
      rows.add(
          new OrganizationProvisioningCompletedInAppNotificationInsertRow(
              requiredText(row.get("eventId"), "eventId"),
              requiredText(row.get("idempotencyKey"), "idempotencyKey"),
              requiredLong(row.get("recipientCenterUserId"), "recipientCenterUserId"),
              requiredText(row.get("targetCustomerId"), "targetCustomerId"),
              requiredText(row.get("targetDbName"), "targetDbName"),
              requiredText(row.get("templateKey"), "templateKey"),
              requiredText(row.get("title"), "title"),
              requiredText(row.get("content"), "content"),
              requiredText(row.get("status"), "status"),
              payloadJson(row.get("payloadJsonPreview"))));
    }
    return rows;
  }

  private List<Map<String, Object>> rowMaps(Map<String, Object> notificationInsertPlan) {
    Object value = notificationInsertPlan.get("insertRows");
    if (!(value instanceof List<?> values)) {
      return List.of();
    }
    List<Map<String, Object>> rows = new ArrayList<>();
    for (Object item : values) {
      if (item instanceof Map<?, ?> map) {
        Map<String, Object> row = new java.util.LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
          row.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        rows.add(row);
      }
    }
    return rows;
  }

  private String requiredText(Object value, String fieldName) {
    String text = stringValue(value);
    if (!StringUtils.hasText(text)) {
      throw new IllegalArgumentException("executorPreflightPlan 缺少 " + fieldName);
    }
    return text;
  }

  private long requiredLong(Object value, String fieldName) {
    if (value instanceof Number number) {
      return number.longValue();
    }
    String text = requiredText(value, fieldName);
    try {
      return Long.parseLong(text);
    } catch (NumberFormatException error) {
      throw new IllegalArgumentException("notificationInsertPlan 字段不是数字: " + fieldName);
    }
  }

  private String payloadJson(Object payload) {
    if (payload == null) {
      return "{}";
    }
    if (payload instanceof String text) {
      return StringUtils.hasText(text) ? text : "{}";
    }
    try {
      return JSON.writeValueAsString(payload);
    } catch (JsonProcessingException error) {
      throw new IllegalArgumentException("notificationInsertPlan payloadJsonPreview 无法序列化", error);
    }
  }

  private List<String> stringList(Object value) {
    if (!(value instanceof List<?> values)) {
      return List.of();
    }
    return values.stream()
        .map(this::stringValue)
        .filter(StringUtils::hasText)
        .map(String::trim)
        .distinct()
        .toList();
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

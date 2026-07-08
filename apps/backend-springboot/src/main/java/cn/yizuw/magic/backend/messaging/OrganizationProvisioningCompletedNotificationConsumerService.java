package cn.yizuw.magic.backend.messaging;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 组织开通完成 notification 消费骨架；当前只做幂等日志、收件人预览和 provider dry-run。 */
@Service
public class OrganizationProvisioningCompletedNotificationConsumerService {

  public static final String CONSUMER_GROUP =
      "rabbit-notification-organization-provisioning-completed";
  public static final String EVENT_TYPE = "rabbit.organization.provisioning.completed.notification";

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

  private final EventConsumeLogRepository eventConsumeLogRepository;
  private final OrganizationProvisioningCompletedNotificationProviderPlanService
      providerPlanService;
  private final OrganizationProvisioningCompletedNotificationRecipientPlanService
      recipientPlanService;

  public OrganizationProvisioningCompletedNotificationConsumerService(
      EventConsumeLogRepository eventConsumeLogRepository,
      OrganizationProvisioningCompletedNotificationProviderPlanService providerPlanService,
      OrganizationProvisioningCompletedNotificationRecipientPlanService recipientPlanService) {
    this.eventConsumeLogRepository = eventConsumeLogRepository;
    this.providerPlanService = providerPlanService;
    this.recipientPlanService = recipientPlanService;
  }

  /**
   * 消费组织开通完成 notification 消息。
   *
   * <p>本批只解析中心库真实收件人预览和 provider dry-run，不调用短信/企微/站内通知 provider，不写租户库。
   */
  public OrganizationProvisioningCompletedNotificationConsumeResult consume(
      OrganizationProvisioningCompletedNotificationConsumeRequest request) {
    if (!OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE.equals(
        request.eventType())) {
      return skipped(request, "unsupported_event_type");
    }
    if (!OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY.equals(
        request.templateKey())) {
      return skipped(request, "unsupported_template_key");
    }

    String eventId = eventId(request);
    List<String> missingHeaders = missingHeaders(request, eventId);
    if (!missingHeaders.isEmpty()) {
      return invalid(request, eventId, "missing_headers:" + String.join(",", missingHeaders));
    }

    Map<String, Object> payload;
    try {
      payload = JSON.readValue(String.valueOf(request.payload()), MAP_TYPE);
    } catch (Exception error) {
      EventConsumeLogEntry entry = entry(request, eventId);
      boolean inserted =
          eventConsumeLogRepository.recordFailure(entry, "invalid payload: " + error.getMessage());
      return failed(request, eventId, inserted);
    }
    if (payload == null) {
      EventConsumeLogEntry entry = entry(request, eventId);
      boolean inserted = eventConsumeLogRepository.recordFailure(entry, "payload is null");
      return failed(request, eventId, inserted);
    }

    Integer jobId = intValue(payload.get("jobId"));
    String targetCustomerId = stringValue(payload.get("targetCustomerId"));
    String targetDbName = stringValue(payload.get("targetDbName"));
    List<String> missingPayloadFields = missingPayloadFields(jobId, targetCustomerId, targetDbName);
    if (!missingPayloadFields.isEmpty()) {
      EventConsumeLogEntry entry = entry(request, eventId);
      boolean inserted =
          eventConsumeLogRepository.recordFailure(
              entry, "missing payload fields: " + String.join(",", missingPayloadFields));
      return failed(request, eventId, inserted);
    }
    if (booleanValue(payload.get("providerCallEnabled"))) {
      return invalid(request, eventId, "provider_call_enabled_not_supported");
    }

    boolean inserted = eventConsumeLogRepository.recordSuccess(entry(request, eventId));
    if (!inserted) {
      return duplicate(request, eventId, jobId, targetCustomerId, targetDbName);
    }
    Map<String, Object> sendPlan =
        sendPlan(eventId, jobId, targetCustomerId, targetDbName, payload);
    return new OrganizationProvisioningCompletedNotificationConsumeResult(
        true,
        false,
        eventId,
        request.idempotencyKey(),
        jobId,
        sendPlan,
        true,
        "notification_send_plan_generated",
        "success",
        targetCustomerId,
        targetDbName);
  }

  private EventConsumeLogEntry entry(
      OrganizationProvisioningCompletedNotificationConsumeRequest request, String eventId) {
    return new EventConsumeLogEntry(
        CONSUMER_GROUP,
        eventId,
        EVENT_TYPE,
        request.idempotencyKey(),
        "magic.notification.queue");
  }

  private OrganizationProvisioningCompletedNotificationConsumeResult skipped(
      OrganizationProvisioningCompletedNotificationConsumeRequest request, String reason) {
    return new OrganizationProvisioningCompletedNotificationConsumeResult(
        false,
        false,
        eventId(request),
        request.idempotencyKey(),
        null,
        Map.of(),
        false,
        reason,
        "skipped",
        null,
        null);
  }

  private OrganizationProvisioningCompletedNotificationConsumeResult invalid(
      OrganizationProvisioningCompletedNotificationConsumeRequest request,
      String eventId,
      String reason) {
    return new OrganizationProvisioningCompletedNotificationConsumeResult(
        false,
        false,
        eventId,
        request.idempotencyKey(),
        null,
        Map.of(),
        false,
        reason,
        "invalid",
        null,
        null);
  }

  private OrganizationProvisioningCompletedNotificationConsumeResult failed(
      OrganizationProvisioningCompletedNotificationConsumeRequest request,
      String eventId,
      boolean inserted) {
    return new OrganizationProvisioningCompletedNotificationConsumeResult(
        false,
        !inserted,
        eventId,
        request.idempotencyKey(),
        null,
        Map.of(),
        false,
        inserted ? "invalid_payload" : "already_consumed",
        inserted ? "failed" : "duplicate",
        null,
        null);
  }

  private OrganizationProvisioningCompletedNotificationConsumeResult duplicate(
      OrganizationProvisioningCompletedNotificationConsumeRequest request,
      String eventId,
      Integer jobId,
      String targetCustomerId,
      String targetDbName) {
    return new OrganizationProvisioningCompletedNotificationConsumeResult(
        false,
        true,
        eventId,
        request.idempotencyKey(),
        jobId,
        Map.of(),
        false,
        "already_consumed",
        "duplicate",
        targetCustomerId,
        targetDbName);
  }

  private Map<String, Object> sendPlan(
      String eventId,
      Integer jobId,
      String targetCustomerId,
      String targetDbName,
      Map<String, Object> payload) {
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE);
    plan.put("planStatus", "preview_only");
    plan.put("jobId", jobId);
    plan.put("targetCustomerId", targetCustomerId);
    plan.put("targetDbName", targetDbName);
    plan.put("templateKey", payload.get("templateKey"));
    List<String> channels = stringList(payload.get("channels"));
    plan.put("channels", channels);
    plan.put("recipientResolution", "center_db_preview_only");
    Map<String, Object> recipientPlan =
        recipientPlanService.buildPlan(jobId, targetCustomerId, targetDbName, channels);
    plan.put("recipientPlan", recipientPlan);
    plan.put(
        "providerPlan",
        providerPlanService.buildPlan(
            jobId, targetCustomerId, targetDbName, eventId, recipientPlan, channels));
    plan.put("providerPlanGenerated", true);
    plan.put("sendEnabled", false);
    plan.put("providerCallEnabled", false);
    return plan;
  }

  private String eventId(OrganizationProvisioningCompletedNotificationConsumeRequest request) {
    if (StringUtils.hasText(request.eventId())) {
      return request.eventId();
    }
    return request.messageId();
  }

  private List<String> missingHeaders(
      OrganizationProvisioningCompletedNotificationConsumeRequest request, String eventId) {
    List<String> missing = new ArrayList<>();
    if (!StringUtils.hasText(eventId)) {
      missing.add("eventId");
    }
    if (!StringUtils.hasText(request.idempotencyKey())) {
      missing.add("idempotencyKey");
    }
    return missing;
  }

  private List<String> missingPayloadFields(
      Integer jobId, String targetCustomerId, String targetDbName) {
    List<String> missing = new ArrayList<>();
    if (jobId == null) {
      missing.add("jobId");
    }
    if (!StringUtils.hasText(targetCustomerId)) {
      missing.add("targetCustomerId");
    }
    if (!StringUtils.hasText(targetDbName)) {
      missing.add("targetDbName");
    }
    return missing;
  }

  private Integer intValue(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (value instanceof String text && StringUtils.hasText(text)) {
      try {
        return Integer.parseInt(text);
      } catch (NumberFormatException ignored) {
        return null;
      }
    }
    return null;
  }

  private String stringValue(Object value) {
    return value == null ? null : String.valueOf(value);
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

  private List<String> stringList(Object value) {
    if (!(value instanceof List<?> values)) {
      return List.of();
    }
    return values.stream().map(this::stringValue).filter(StringUtils::hasText).toList();
  }
}

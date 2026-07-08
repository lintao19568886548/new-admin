package cn.yizuw.magic.backend.messaging;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 消费组织空间开通完成事件；本批只投递 RabbitMQ 轻任务，不直接通知或刷新缓存。 */
@Service
public class OrganizationProvisioningCompletedConsumerService {

  public static final String EVENT_TYPE = "organization.provisioning.completed";
  public static final String TOPIC = "magic.organization.provisioning";

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

  private final EventConsumeLogRepository eventConsumeLogRepository;
  private final OrganizationProvisioningCompletedFollowupPublisher followupPublisher;

  public OrganizationProvisioningCompletedConsumerService(
      EventConsumeLogRepository eventConsumeLogRepository,
      OrganizationProvisioningCompletedFollowupPublisher followupPublisher) {
    this.eventConsumeLogRepository = eventConsumeLogRepository;
    this.followupPublisher = followupPublisher;
  }

  /**
   * 消费完成事件。
   *
   * <p>缺失关键消息头时直接返回 invalid，不写库；合法完成事件会先认领消费日志，再投递 RabbitMQ 轻任务。
   */
  public OrganizationProvisioningCompletedConsumeResult consume(
      OrganizationProvisioningCompletedConsumeRequest request) {
    if (!EVENT_TYPE.equals(request.eventType())) {
      return skipped(request, "unsupported_event_type");
    }

    List<String> missingHeaders = missingHeaders(request);
    if (!missingHeaders.isEmpty()) {
      return invalid(request, "missing_headers:" + String.join(",", missingHeaders));
    }

    Map<String, Object> payload;
    try {
      payload = JSON.readValue(String.valueOf(request.payload()), MAP_TYPE);
    } catch (Exception error) {
      EventConsumeLogEntry entry = entry(request);
      boolean inserted =
          eventConsumeLogRepository.recordFailure(entry, "invalid payload: " + error.getMessage());
      return new OrganizationProvisioningCompletedConsumeResult(
          false,
          request.customerId(),
          !inserted,
          request.eventId(),
          request.eventType(),
          false,
          null,
          request.idempotencyKey(),
          null,
          inserted ? "invalid_payload" : "already_consumed",
          inserted ? "failed" : "duplicate",
          null,
          null);
    }
    if (payload == null) {
      EventConsumeLogEntry entry = entry(request);
      boolean inserted = eventConsumeLogRepository.recordFailure(entry, "payload is null");
      return failedPayload(request, inserted);
    }

    Integer jobId = intValue(payload.get("jobId"));
    String targetCustomerId = stringValue(payload.get("targetCustomerId"));
    String targetDbName = stringValue(payload.get("targetDbName"));
    List<String> missingPayloadFields = missingPayloadFields(jobId, targetCustomerId, targetDbName);
    if (!missingPayloadFields.isEmpty()) {
      EventConsumeLogEntry entry = entry(request);
      boolean inserted =
          eventConsumeLogRepository.recordFailure(
              entry, "missing payload fields: " + String.join(",", missingPayloadFields));
      return failedPayload(request, inserted);
    }
    if (!request.customerId().equals(targetCustomerId)) {
      EventConsumeLogEntry entry = entry(request);
      boolean inserted =
          eventConsumeLogRepository.recordFailure(
              entry,
              "customerId header mismatch: "
                  + request.customerId()
                  + " != "
                  + targetCustomerId);
      return failedPayload(request, inserted);
    }

    EventConsumeLogEntry entry = entry(request);
    EventConsumeClaimResult claimResult = eventConsumeLogRepository.claimProcessing(entry);
    if (claimResult != EventConsumeClaimResult.CLAIMED) {
      return duplicate(request, claimResult);
    }

    String messageId;
    try {
      messageId = followupPublisher.publish(request, payload, jobId, targetCustomerId, targetDbName);
      eventConsumeLogRepository.markSuccess(entry);
    } catch (RuntimeException error) {
      eventConsumeLogRepository.markFailure(
          entry, "RabbitMQ followup publish failed: " + error.getMessage());
      throw error;
    }

    return new OrganizationProvisioningCompletedConsumeResult(
        true,
        request.customerId(),
        false,
        request.eventId(),
        request.eventType(),
        true,
        messageId,
        request.idempotencyKey(),
        jobId,
        "rabbit_light_task_queued",
        "success",
        targetCustomerId,
        targetDbName);
  }

  private EventConsumeLogEntry entry(OrganizationProvisioningCompletedConsumeRequest request) {
    return new EventConsumeLogEntry(
        request.consumerGroup(),
        request.eventId(),
        request.eventType(),
        request.idempotencyKey(),
        request.topic());
  }

  private OrganizationProvisioningCompletedConsumeResult skipped(
      OrganizationProvisioningCompletedConsumeRequest request, String reason) {
    return new OrganizationProvisioningCompletedConsumeResult(
        false,
        request.customerId(),
        false,
        request.eventId(),
        request.eventType(),
        false,
        null,
        request.idempotencyKey(),
        null,
        reason,
        "skipped",
        null,
        null);
  }

  private OrganizationProvisioningCompletedConsumeResult invalid(
      OrganizationProvisioningCompletedConsumeRequest request, String reason) {
    return new OrganizationProvisioningCompletedConsumeResult(
        false,
        request.customerId(),
        false,
        request.eventId(),
        request.eventType(),
        false,
        null,
        request.idempotencyKey(),
        null,
        reason,
        "invalid",
        null,
        null);
  }

  private List<String> missingHeaders(OrganizationProvisioningCompletedConsumeRequest request) {
    List<String> missing = new ArrayList<>();
    if (!StringUtils.hasText(request.consumerGroup())) {
      missing.add("consumerGroup");
    }
    if (!StringUtils.hasText(request.customerId())) {
      missing.add("customerId");
    }
    if (!StringUtils.hasText(request.eventId())) {
      missing.add("eventId");
    }
    if (!StringUtils.hasText(request.idempotencyKey())) {
      missing.add("idempotencyKey");
    }
    if (!StringUtils.hasText(request.topic())) {
      missing.add("topic");
    }
    return missing;
  }

  private OrganizationProvisioningCompletedConsumeResult failedPayload(
      OrganizationProvisioningCompletedConsumeRequest request, boolean inserted) {
    return new OrganizationProvisioningCompletedConsumeResult(
        false,
        request.customerId(),
        !inserted,
        request.eventId(),
        request.eventType(),
        false,
        null,
        request.idempotencyKey(),
        null,
        inserted ? "invalid_payload" : "already_consumed",
        inserted ? "failed" : "duplicate",
        null,
        null);
  }

  private OrganizationProvisioningCompletedConsumeResult duplicate(
      OrganizationProvisioningCompletedConsumeRequest request, EventConsumeClaimResult claimResult) {
    String reason =
        claimResult == EventConsumeClaimResult.DUPLICATE_SUCCESS
            ? "already_consumed"
            : "already_processing";
    return new OrganizationProvisioningCompletedConsumeResult(
        false,
        request.customerId(),
        true,
        request.eventId(),
        request.eventType(),
        false,
        null,
        request.idempotencyKey(),
        null,
        reason,
        "duplicate",
        null,
        null);
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
}

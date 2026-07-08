package cn.yizuw.magic.backend.messaging;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 组织开通完成 RabbitMQ followup 消费服务；生成计划并按安全门投递通知队列。 */
@Service
public class OrganizationProvisioningCompletedFollowupConsumerService {

  public static final String CONSUMER_GROUP =
      "rabbit-light-task-organization-provisioning-followup";
  public static final String EVENT_TYPE = "rabbit.organization.provisioning.completed.followup";

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

  private final EventConsumeLogRepository eventConsumeLogRepository;
  private final OrganizationProvisioningCompletedNotificationPublisher notificationPublisher;
  private final OrganizationProvisioningCompletedNotificationPlanService notificationPlanService;
  private final OrganizationProvisioningCompletedRedisRefreshExecutor redisRefreshExecutor;
  private final OrganizationProvisioningCompletedRedisRefreshPlanService redisRefreshPlanService;

  public OrganizationProvisioningCompletedFollowupConsumerService(
      EventConsumeLogRepository eventConsumeLogRepository,
      OrganizationProvisioningCompletedNotificationPublisher notificationPublisher,
      OrganizationProvisioningCompletedNotificationPlanService notificationPlanService,
      OrganizationProvisioningCompletedRedisRefreshExecutor redisRefreshExecutor,
      OrganizationProvisioningCompletedRedisRefreshPlanService redisRefreshPlanService) {
    this.eventConsumeLogRepository = eventConsumeLogRepository;
    this.notificationPublisher = notificationPublisher;
    this.notificationPlanService = notificationPlanService;
    this.redisRefreshExecutor = redisRefreshExecutor;
    this.redisRefreshPlanService = redisRefreshPlanService;
  }

  /**
   * 消费 RabbitMQ followup 轻任务。
   *
   * <p>当前批次验证任务类型、解析 payload、生成后续计划，并在
   * `RABBITMQ_NOTIFICATION_PUBLISH_ENABLED=true` 时只投递 RabbitMQ notification 队列。
   * 不刷新 Redis，不调用短信/企微/站内通知 provider。
   */
  public OrganizationProvisioningCompletedFollowupConsumeResult consume(
      OrganizationProvisioningCompletedFollowupConsumeRequest request) {
    if (!OrganizationProvisioningCompletedFollowupPublisher.TASK_TYPE.equals(request.taskType())) {
      return skipped(request, "unsupported_task_type");
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

    EventConsumeLogEntry entry = entry(request, eventId);
    EventConsumeClaimResult claimResult = eventConsumeLogRepository.claimProcessing(entry);
    if (claimResult != EventConsumeClaimResult.CLAIMED) {
      return duplicate(request, eventId, jobId, targetCustomerId, targetDbName, claimResult);
    }

    Map<String, Object> notificationPlan = Map.of();
    Map<String, Object> redisRefreshPlan = Map.of();
    boolean notificationMessagePublished = false;
    String notificationMessageId = null;
    boolean redisCachesRefreshed = false;
    String processingStage = "notification_plan";
    try {
      notificationPlan = notificationPlanService.buildPlan(jobId, targetCustomerId, targetDbName);
      processingStage = "redis_refresh_plan";
      redisRefreshPlan = redisRefreshPlanService.buildPlan(jobId, targetCustomerId, targetDbName);
      if (Boolean.TRUE.equals(redisRefreshPlan.get("cacheEvictEnabled"))) {
        processingStage = "redis_cache_evict";
        int evictedPrefixCount = redisRefreshExecutor.refresh(redisRefreshPlan);
        redisRefreshPlan.put("planStatus", "cache_evicted");
        redisRefreshPlan.put("cacheEvictRequested", true);
        redisRefreshPlan.put("cacheEvictExecuted", true);
        redisRefreshPlan.put("cacheEvictPrefixCount", evictedPrefixCount);
        redisCachesRefreshed = true;
      }
      if (Boolean.TRUE.equals(notificationPlan.get("rabbitNotificationPublishEnabled"))) {
        processingStage = "rabbit_notification_publish";
        notificationMessageId = notificationPublisher.publish(notificationPlan);
        notificationMessagePublished = true;
        notificationPlan.put("planStatus", "rabbit_notification_queued");
        notificationPlan.put("rabbitNotificationDryRun", false);
        notificationPlan.put("rabbitNotificationPublishRequested", true);
        notificationPlan.put("rabbitNotificationPublishExecuted", true);
        notificationPlan.put("rabbitNotificationMessageId", notificationMessageId);
        markRabbitPreviewPublished(notificationPlan);
      }
      processingStage = "consume_log_success";
      eventConsumeLogRepository.markSuccess(entry);
    } catch (RuntimeException error) {
      eventConsumeLogRepository.markFailure(entry, failureMessage(processingStage, error));
      throw error;
    }
    return new OrganizationProvisioningCompletedFollowupConsumeResult(
        true,
        false,
        eventId,
        request.idempotencyKey(),
        jobId,
        notificationMessagePublished,
        notificationMessageId,
        notificationPlan,
        true,
        redisRefreshPlan,
        true,
        successReason(notificationMessagePublished, redisCachesRefreshed),
        "success",
        targetCustomerId,
        targetDbName);
  }

  private EventConsumeLogEntry entry(
      OrganizationProvisioningCompletedFollowupConsumeRequest request, String eventId) {
    return new EventConsumeLogEntry(
        CONSUMER_GROUP,
        eventId,
        EVENT_TYPE,
        request.idempotencyKey(),
        "magic.light-task.queue");
  }

  private OrganizationProvisioningCompletedFollowupConsumeResult skipped(
      OrganizationProvisioningCompletedFollowupConsumeRequest request, String reason) {
    return new OrganizationProvisioningCompletedFollowupConsumeResult(
        false,
        false,
        eventId(request),
        request.idempotencyKey(),
        null,
        false,
        null,
        Map.of(),
        false,
        Map.of(),
        false,
        reason,
        "skipped",
        null,
        null);
  }

  private OrganizationProvisioningCompletedFollowupConsumeResult invalid(
      OrganizationProvisioningCompletedFollowupConsumeRequest request, String eventId, String reason) {
    return new OrganizationProvisioningCompletedFollowupConsumeResult(
        false,
        false,
        eventId,
        request.idempotencyKey(),
        null,
        false,
        null,
        Map.of(),
        false,
        Map.of(),
        false,
        reason,
        "invalid",
        null,
        null);
  }

  private OrganizationProvisioningCompletedFollowupConsumeResult failed(
      OrganizationProvisioningCompletedFollowupConsumeRequest request,
      String eventId,
      boolean inserted) {
    return new OrganizationProvisioningCompletedFollowupConsumeResult(
        false,
        !inserted,
        eventId,
        request.idempotencyKey(),
        null,
        false,
        null,
        Map.of(),
        false,
        Map.of(),
        false,
        inserted ? "invalid_payload" : "already_consumed",
        inserted ? "failed" : "duplicate",
        null,
        null);
  }

  private OrganizationProvisioningCompletedFollowupConsumeResult duplicate(
      OrganizationProvisioningCompletedFollowupConsumeRequest request,
      String eventId,
      Integer jobId,
      String targetCustomerId,
      String targetDbName,
      EventConsumeClaimResult claimResult) {
    return new OrganizationProvisioningCompletedFollowupConsumeResult(
        false,
        true,
        eventId,
        request.idempotencyKey(),
        jobId,
        false,
        null,
        Map.of(),
        false,
        Map.of(),
        false,
        claimResult == EventConsumeClaimResult.IN_PROGRESS ? "already_processing" : "already_consumed",
        "duplicate",
        targetCustomerId,
        targetDbName);
  }

  @SuppressWarnings("unchecked")
  private void markRabbitPreviewPublished(Map<String, Object> notificationPlan) {
    Object preview = notificationPlan.get("rabbitMessagePreview");
    if (preview instanceof Map<?, ?> map) {
      ((Map<String, Object>) map).put("publishExecuted", true);
    }
  }

  private String failureMessage(String processingStage, RuntimeException error) {
    String message = error.getMessage();
    if ("rabbit_notification_publish".equals(processingStage)) {
      return "RabbitMQ notification publish failed: " + message;
    }
    if ("consume_log_success".equals(processingStage)) {
      return "RabbitMQ followup mark success failed: " + message;
    }
    return "RabbitMQ followup plan failed at " + processingStage + ": " + message;
  }

  private String successReason(
      boolean notificationMessagePublished, boolean redisCachesRefreshed) {
    if (notificationMessagePublished) {
      return "notification_message_published";
    }
    if (redisCachesRefreshed) {
      return "redis_cache_evicted";
    }
    return "followup_plans_generated";
  }

  private String eventId(OrganizationProvisioningCompletedFollowupConsumeRequest request) {
    if (StringUtils.hasText(request.eventId())) {
      return request.eventId();
    }
    return request.messageId();
  }

  private List<String> missingHeaders(
      OrganizationProvisioningCompletedFollowupConsumeRequest request, String eventId) {
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
}

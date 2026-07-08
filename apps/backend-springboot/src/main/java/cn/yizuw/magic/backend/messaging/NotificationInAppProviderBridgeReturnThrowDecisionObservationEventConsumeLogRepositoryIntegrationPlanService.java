package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** event_consume_log repository integration plan；只生成未来仓储调用预案，不执行 SQL。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService {

  public Map<String, Object> buildPlan(
      Map<String, Object> eventConsumeLogWritePlan, Map<String, Object> eventMetadataPlan) {
    Map<String, Object> writePlan = mapValue(eventConsumeLogWritePlan);
    Map<String, Object> metadataPlan = mapValue(eventMetadataPlan);
    boolean databaseWritePlanned = Boolean.TRUE.equals(writePlan.get("databaseWritePlanned"));
    boolean targetTableReady = "event_consume_log".equals(stringValue(writePlan.get("targetTable")));
    String consumerGroup = stringValue(metadataPlan.get("consumerGroup"));
    String eventId = stringValue(metadataPlan.get("eventId"));
    String eventType = stringValue(metadataPlan.get("eventType"));
    String idempotencyKey = stringValue(metadataPlan.get("idempotencyKey"));
    String topic = stringValue(metadataPlan.get("topic"));
    boolean metadataReady =
        !consumerGroup.isBlank()
            && !eventId.isBlank()
            && !eventType.isBlank()
            && !idempotencyKey.isBlank()
            && !topic.isBlank();
    boolean ready = databaseWritePlanned && targetTableReady && metadataReady;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_event_consume_log_repository_integration");
    plan.put(
        "planStatus",
        ready ? "ready_for_event_consume_log_repository_integration_dry_run" : "blocked");
    plan.put("eventConsumeLogWritePlanProvided", !writePlan.isEmpty());
    plan.put("databaseWritePlanned", databaseWritePlanned);
    plan.put("targetTableReady", targetTableReady);
    plan.put("eventMetadataProvided", !metadataPlan.isEmpty());
    plan.put("eventMetadataReady", metadataReady);
    plan.put("repositoryIntegrationPlanned", ready);
    plan.put("repositoryClassPreview", ready ? "EventConsumeLogRepository" : "");
    plan.put("repositoryMethodPreview", ready ? "recordSuccess(EventConsumeLogEntry)" : "");
    plan.put("eventConsumeLogEntryPreview", ready ? entryPreview(consumerGroup, eventId, eventType, idempotencyKey, topic) : Map.of());
    plan.put("repositoryInvoked", false);
    plan.put("databaseWriteExecuted", false);
    plan.put("sqlExecuted", false);
    plan.put("listenerPolicyChanged", false);
    plan.put("decisionApplied", false);
    plan.put("throwRequested", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("rabbitRejectExecuted", false);
    plan.put(
        "blockedReasons",
        blockedReasons(writePlan, databaseWritePlanned, targetTableReady, metadataReady));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_event_consume_log_repository_dry_run_listener_integration_batch"
            : "keep_repository_integration_blocked_until_write_plan_and_metadata_ready");
    return plan;
  }

  private Map<String, Object> entryPreview(
      String consumerGroup, String eventId, String eventType, String idempotencyKey, String topic) {
    Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("type", "EventConsumeLogEntry");
    preview.put("consumerGroup", consumerGroup);
    preview.put("eventId", eventId);
    preview.put("eventType", eventType);
    preview.put("idempotencyKey", idempotencyKey);
    preview.put("topic", topic);
    return preview;
  }

  private List<String> blockedReasons(
      Map<String, Object> writePlan,
      boolean databaseWritePlanned,
      boolean targetTableReady,
      boolean metadataReady) {
    List<String> reasons = new ArrayList<>();
    if (writePlan.isEmpty()) {
      reasons.add("event_consume_log write plan 缺失，不能规划 repository 集成");
    }
    if (!databaseWritePlanned) {
      reasons.add("databaseWritePlanned=false，不能规划 repository 集成");
    }
    if (!targetTableReady) {
      reasons.add("targetTable 不是 event_consume_log，不能规划 repository 集成");
    }
    if (!metadataReady) {
      reasons.add("event metadata 缺失，不能构造 EventConsumeLogEntry 预览");
    }
    return reasons;
  }

  private Map<String, Object> mapValue(Object value) {
    if (value instanceof Map<?, ?> map) {
      Map<String, Object> result = new LinkedHashMap<>();
      for (Map.Entry<?, ?> entry : map.entrySet()) {
        result.put(String.valueOf(entry.getKey()), entry.getValue());
      }
      return result;
    }
    return Map.of();
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

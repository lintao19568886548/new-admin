package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** EventConsumeLogRepository 调用预案；只描述未来 recordSuccess 调用，不持有仓储。 */
@Service
public class NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService {

  public Map<String, Object> buildPlan(Map<String, Object> repositoryIntegrationPlan) {
    Map<String, Object> integrationPlan = mapValue(repositoryIntegrationPlan);
    boolean repositoryIntegrationPlanned =
        Boolean.TRUE.equals(integrationPlan.get("repositoryIntegrationPlanned"));
    boolean repositoryClassReady =
        "EventConsumeLogRepository".equals(stringValue(integrationPlan.get("repositoryClassPreview")));
    boolean repositoryMethodReady =
        "recordSuccess(EventConsumeLogEntry)"
            .equals(stringValue(integrationPlan.get("repositoryMethodPreview")));
    Map<String, Object> entryPreview = mapValue(integrationPlan.get("eventConsumeLogEntryPreview"));
    boolean entryReady =
        "EventConsumeLogEntry".equals(stringValue(entryPreview.get("type")))
            && !stringValue(entryPreview.get("consumerGroup")).isBlank()
            && !stringValue(entryPreview.get("eventId")).isBlank()
            && !stringValue(entryPreview.get("eventType")).isBlank()
            && !stringValue(entryPreview.get("idempotencyKey")).isBlank()
            && !stringValue(entryPreview.get("topic")).isBlank();
    boolean ready =
        repositoryIntegrationPlanned
            && repositoryClassReady
            && repositoryMethodReady
            && entryReady;

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "notification.consumer.delegation.in_app_provider.bridge_return_throw_decision_observation_event_consume_log_repository_call");
    plan.put("planStatus", ready ? "ready_for_event_consume_log_repository_call_dry_run" : "blocked");
    plan.put("repositoryIntegrationPlanProvided", !integrationPlan.isEmpty());
    plan.put("repositoryIntegrationReady", repositoryIntegrationPlanned);
    plan.put("repositoryClassReady", repositoryClassReady);
    plan.put("repositoryMethodReady", repositoryMethodReady);
    plan.put("eventConsumeLogEntryReady", entryReady);
    plan.put("repositoryCallPlanned", ready);
    plan.put("repositoryBeanPreview", ready ? "EventConsumeLogRepository" : "");
    plan.put("repositoryMethodPreview", ready ? "recordSuccess" : "");
    plan.put("repositoryArgumentPreview", ready ? entryPreview : Map.of());
    plan.put(
        "repositoryInvocationOrderPreview",
        ready
            ? List.of(
                "build EventConsumeLogEntry",
                "call EventConsumeLogRepository.recordSuccess",
                "ignore inserted result until listener execution gate")
            : List.of());
    plan.put("insertedResultObserved", false);
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
        blockedReasons(
            integrationPlan,
            repositoryIntegrationPlanned,
            repositoryClassReady,
            repositoryMethodReady,
            entryReady));
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_event_consume_log_repository_execution_gate_batch"
            : "keep_repository_call_blocked_until_repository_integration_plan_ready");
    return plan;
  }

  private List<String> blockedReasons(
      Map<String, Object> integrationPlan,
      boolean repositoryIntegrationPlanned,
      boolean repositoryClassReady,
      boolean repositoryMethodReady,
      boolean entryReady) {
    List<String> reasons = new ArrayList<>();
    if (integrationPlan.isEmpty()) {
      reasons.add("repository integration plan 缺失，不能规划 repository 调用");
    }
    if (!repositoryIntegrationPlanned) {
      reasons.add("repositoryIntegrationPlanned=false，不能规划 repository 调用");
    }
    if (!repositoryClassReady) {
      reasons.add("repositoryClassPreview 不是 EventConsumeLogRepository");
    }
    if (!repositoryMethodReady) {
      reasons.add("repositoryMethodPreview 不是 recordSuccess(EventConsumeLogEntry)");
    }
    if (!entryReady) {
      reasons.add("eventConsumeLogEntryPreview 缺失，不能构造 repository 调用参数");
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

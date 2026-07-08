package cn.yizuw.magic.backend.messaging;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 专用 consumer result 到 validator consumerResult 入参的纯适配器；不调用 validator。 */
@Service
public class NotificationInAppProviderConsumerResultAdapterService {

  public Map<String, Object> adapt(
      OrganizationProvisioningCompletedNotificationConsumeResult sourceResult) {
    List<String> blockedReasons = blockedReasons(sourceResult);
    boolean ready = blockedReasons.isEmpty();
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", "notification.consumer.delegation.in_app_provider.consumer_result_adapter");
    plan.put("planStatus", ready ? "ready_for_consumer_result_adapter_dry_run" : "blocked");
    plan.put("sourceResultType", "OrganizationProvisioningCompletedNotificationConsumeResult");
    plan.put("sourceResultProvided", sourceResult != null);
    plan.put("sourceResultAckable", ackable(sourceResult));
    plan.put("sendPlanGenerated", sourceResult != null && sourceResult.sendPlanGenerated());
    plan.put("sendPlanProvided", sendPlanProvided(sourceResult));
    plan.put("targetArgumentName", "consumerResult");
    plan.put("targetArgumentType", "Map<String,Object>");
    plan.put("consumerResult", ready ? consumerResult(sourceResult) : Map.of());
    plan.put("consumerResultConstructed", ready);
    plan.put("consumerResultForwardedToValidator", false);
    plan.put("classificationExecuted", false);
    plan.put("manualExecutionAllowed", false);
    plan.put("rabbitAckExecuted", false);
    plan.put("rabbitNackExecuted", false);
    plan.put("blockedReasons", blockedReasons);
    plan.put(
        "nextAction",
        ready
            ? "ready_for_future_validator_classify_dry_run_batch"
            : "fix_consumer_result_adapter_blockers_before_validator_classify");
    return plan;
  }

  private List<String> blockedReasons(
      OrganizationProvisioningCompletedNotificationConsumeResult sourceResult) {
    List<String> reasons = new ArrayList<>();
    if (sourceResult == null) {
      reasons.add("dedicated consumer result 缺失，不能构造 validator consumerResult");
      return reasons;
    }
    if (!ackable(sourceResult)) {
      reasons.add("dedicated consumer result 非 ackable，不能构造 validator consumerResult");
    }
    if (!sourceResult.sendPlanGenerated()) {
      reasons.add("dedicated consumer result 未生成 sendPlan，不能构造 validator consumerResult");
    }
    if (!sendPlanProvided(sourceResult)) {
      reasons.add("dedicated consumer result sendPlan 缺失，不能构造 validator consumerResult");
    }
    return reasons;
  }

  private boolean ackable(OrganizationProvisioningCompletedNotificationConsumeResult sourceResult) {
    return sourceResult != null && (sourceResult.consumed() || sourceResult.duplicate());
  }

  private boolean sendPlanProvided(
      OrganizationProvisioningCompletedNotificationConsumeResult sourceResult) {
    return sourceResult != null && sourceResult.sendPlan() != null && !sourceResult.sendPlan().isEmpty();
  }

  private Map<String, Object> consumerResult(
      OrganizationProvisioningCompletedNotificationConsumeResult sourceResult) {
    Map<String, Object> consumerResult = new LinkedHashMap<>();
    consumerResult.put("sendPlan", sourceResult.sendPlan());
    consumerResult.put("eventId", sourceResult.eventId());
    consumerResult.put("idempotencyKey", sourceResult.idempotencyKey());
    consumerResult.put("status", sourceResult.status());
    consumerResult.put("reason", sourceResult.reason());
    return consumerResult;
  }
}

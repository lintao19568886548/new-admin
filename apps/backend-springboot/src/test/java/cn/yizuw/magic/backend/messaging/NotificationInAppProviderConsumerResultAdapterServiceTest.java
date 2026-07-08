package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** consumer result adapter 测试；只验证纯结构适配，不调用 validator 或 RabbitMQ ack/nack。 */
class NotificationInAppProviderConsumerResultAdapterServiceTest {

  private final NotificationInAppProviderConsumerResultAdapterService service =
      new NotificationInAppProviderConsumerResultAdapterService();

  @Test
  void adaptBuildsConsumerResultWhenAckableResultHasSendPlan() {
    Map<String, Object> sendPlan = sendPlan();

    Map<String, Object> plan = service.adapt(success(sendPlan));

    assertThat(plan)
        .containsEntry(
            "planType", "notification.consumer.delegation.in_app_provider.consumer_result_adapter")
        .containsEntry("planStatus", "ready_for_consumer_result_adapter_dry_run")
        .containsEntry("sourceResultType", "OrganizationProvisioningCompletedNotificationConsumeResult")
        .containsEntry("sourceResultProvided", true)
        .containsEntry("sourceResultAckable", true)
        .containsEntry("sendPlanGenerated", true)
        .containsEntry("sendPlanProvided", true)
        .containsEntry("targetArgumentName", "consumerResult")
        .containsEntry("targetArgumentType", "Map<String,Object>")
        .containsEntry("consumerResultConstructed", true)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry("nextAction", "ready_for_future_validator_classify_dry_run_batch");
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) plan.get("blockedReasons");
    assertThat(blockedReasons).isEmpty();
    @SuppressWarnings("unchecked")
    Map<String, Object> consumerResult = (Map<String, Object>) plan.get("consumerResult");
    assertThat(consumerResult)
        .containsEntry("sendPlan", sendPlan)
        .containsEntry("eventId", "evt_31")
        .containsEntry("idempotencyKey", "idem_31")
        .containsEntry("status", "success")
        .containsEntry("reason", "notification_send_plan_generated");
  }

  @Test
  void adaptBlocksWhenResultIsMissing() {
    Map<String, Object> plan = service.adapt(null);

    assertBlocked(
        plan, "dedicated consumer result 缺失，不能构造 validator consumerResult");
    assertThat(plan)
        .containsEntry("sourceResultProvided", false)
        .containsEntry("sourceResultAckable", false)
        .containsEntry("sendPlanGenerated", false)
        .containsEntry("sendPlanProvided", false);
  }

  @Test
  void adaptBlocksWhenDuplicateResultHasNoSendPlan() {
    Map<String, Object> plan =
        service.adapt(
            new OrganizationProvisioningCompletedNotificationConsumeResult(
                false,
                true,
                "evt_31",
                "idem_31",
                31,
                Map.of(),
                false,
                "already_consumed",
                "duplicate",
                "org001",
                "tenant_org001"));

    assertBlocked(
        plan,
        "dedicated consumer result 未生成 sendPlan，不能构造 validator consumerResult",
        "dedicated consumer result sendPlan 缺失，不能构造 validator consumerResult");
    assertThat(plan)
        .containsEntry("sourceResultAckable", true)
        .containsEntry("sendPlanGenerated", false)
        .containsEntry("sendPlanProvided", false);
  }

  @Test
  void adaptBlocksWhenResultIsNotAckable() {
    Map<String, Object> plan =
        service.adapt(
            new OrganizationProvisioningCompletedNotificationConsumeResult(
                false,
                false,
                "evt_31",
                "idem_31",
                31,
                sendPlan(),
                true,
                "invalid_payload",
                "invalid",
                "org001",
                "tenant_org001"));

    assertBlocked(
        plan, "dedicated consumer result 非 ackable，不能构造 validator consumerResult");
    assertThat(plan)
        .containsEntry("sourceResultAckable", false)
        .containsEntry("sendPlanGenerated", true)
        .containsEntry("sendPlanProvided", true);
  }

  @SuppressWarnings("unchecked")
  private void assertBlocked(Map<String, Object> plan, String... expectedReasons) {
    assertThat(plan)
        .containsEntry("planStatus", "blocked")
        .containsEntry("consumerResultConstructed", false)
        .containsEntry("consumerResultForwardedToValidator", false)
        .containsEntry("classificationExecuted", false)
        .containsEntry("manualExecutionAllowed", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false)
        .containsEntry(
            "nextAction", "fix_consumer_result_adapter_blockers_before_validator_classify");
    assertThat((Map<String, Object>) plan.get("consumerResult")).isEmpty();
    assertThat((List<String>) plan.get("blockedReasons")).contains(expectedReasons);
  }

  private OrganizationProvisioningCompletedNotificationConsumeResult success(
      Map<String, Object> sendPlan) {
    return new OrganizationProvisioningCompletedNotificationConsumeResult(
        true,
        false,
        "evt_31",
        "idem_31",
        31,
        sendPlan,
        true,
        "notification_send_plan_generated",
        "success",
        "org001",
        "tenant_org001");
  }

  private Map<String, Object> sendPlan() {
    Map<String, Object> inAppExecutionPlan = new LinkedHashMap<>();
    inAppExecutionPlan.put("planStatus", "ready_for_write_plan");
    inAppExecutionPlan.put("listenerAutoExecutionGatePlan", Map.of("invocationPlan", Map.of()));
    Map<String, Object> providerPlan = new LinkedHashMap<>();
    providerPlan.put("inAppExecutionPlan", inAppExecutionPlan);
    Map<String, Object> sendPlan = new LinkedHashMap<>();
    sendPlan.put("providerPlan", providerPlan);
    return sendPlan;
  }
}

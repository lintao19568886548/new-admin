package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** RabbitMQ notification 消费测试；当前只验证幂等日志和 provider 边界。 */
class OrganizationProvisioningCompletedNotificationConsumerServiceTest {

  private EventConsumeLogRepository eventConsumeLogRepository;
  private OrganizationProvisioningCompletedNotificationProviderPlanService providerPlanService;
  private OrganizationProvisioningCompletedNotificationRecipientPlanService recipientPlanService;
  private OrganizationProvisioningCompletedNotificationConsumerService consumerService;

  @BeforeEach
  void setUp() {
    eventConsumeLogRepository = org.mockito.Mockito.mock(EventConsumeLogRepository.class);
    recipientPlanService =
        org.mockito.Mockito.mock(
            OrganizationProvisioningCompletedNotificationRecipientPlanService.class);
    providerPlanService =
        org.mockito.Mockito.mock(
            OrganizationProvisioningCompletedNotificationProviderPlanService.class);
    consumerService =
        new OrganizationProvisioningCompletedNotificationConsumerService(
            eventConsumeLogRepository, providerPlanService, recipientPlanService);
  }

  @Test
  void consumeRecordsSuccessAndGeneratesSendPlan() {
    when(eventConsumeLogRepository.recordSuccess(any())).thenReturn(true);
    when(recipientPlanService.buildPlan(
            eq(31), eq("org001"), eq("tenant_org001"), any()))
        .thenReturn(
            Map.of(
                "recipientResolutionStatus",
                "preview_only",
                "recipientCount",
                1,
                "recipients",
                List.of(Map.of("centerUserId", 1001, "channels", List.of("in_app", "sms"))),
                "sendEnabled",
                false,
                "providerCallEnabled",
                false));
    when(providerPlanService.buildPlan(
            eq(31), eq("org001"), eq("tenant_org001"), eq("evt_notification_31"), any(), any()))
        .thenReturn(
            Map.of(
                "planStatus",
                "dry_run",
                "providerCallExecuted",
                false,
                "sendEnabled",
                false));

    OrganizationProvisioningCompletedNotificationConsumeResult result =
        consumerService.consume(request(payload(false)));

    assertThat(result.consumed()).isTrue();
    assertThat(result.duplicate()).isFalse();
    assertThat(result.eventId()).isEqualTo("evt_notification_31");
    assertThat(result.jobId()).isEqualTo(31);
    assertThat(result.reason()).isEqualTo("notification_send_plan_generated");
    assertThat(result.status()).isEqualTo("success");
    assertThat(result.targetCustomerId()).isEqualTo("org001");
    assertThat(result.targetDbName()).isEqualTo("tenant_org001");
    assertThat(result.sendPlanGenerated()).isTrue();
    assertThat(result.sendPlan())
        .containsEntry("planStatus", "preview_only")
        .containsEntry("recipientResolution", "center_db_preview_only")
        .containsEntry("providerPlanGenerated", true)
        .containsEntry("sendEnabled", false)
        .containsEntry("providerCallEnabled", false);
    assertThat((Map<String, Object>) result.sendPlan().get("recipientPlan"))
        .containsEntry("recipientResolutionStatus", "preview_only")
        .containsEntry("recipientCount", 1)
        .containsEntry("providerCallEnabled", false);
    assertThat((Map<String, Object>) result.sendPlan().get("providerPlan"))
        .containsEntry("planStatus", "dry_run")
        .containsEntry("providerCallExecuted", false)
        .containsEntry("sendEnabled", false);
    verify(eventConsumeLogRepository).recordSuccess(any());
    verify(recipientPlanService)
        .buildPlan(
            31, "org001", "tenant_org001", List.of("in_app", "wechat_work", "sms"));
    verify(providerPlanService)
        .buildPlan(
            eq(31),
            eq("org001"),
            eq("tenant_org001"),
            eq("evt_notification_31"),
            any(),
            eq(List.of("in_app", "wechat_work", "sms")));
  }

  @Test
  void consumeRecordsSuccessWhenRecipientPreviewIsBlocked() {
    when(eventConsumeLogRepository.recordSuccess(any())).thenReturn(true);
    when(recipientPlanService.buildPlan(
            eq(31), eq("org001"), eq("tenant_org001"), any()))
        .thenReturn(
            Map.of(
                "recipientResolutionStatus",
                "blocked",
                "recipientCount",
                0,
                "blockedReasons",
                List.of("中心库收件人解析表未就绪: user"),
                "sendEnabled",
                false,
                "providerCallEnabled",
                false));
    when(providerPlanService.buildPlan(
            eq(31), eq("org001"), eq("tenant_org001"), eq("evt_notification_31"), any(), any()))
        .thenReturn(
            Map.of(
                "planStatus",
                "dry_run",
                "providerCallExecuted",
                false,
                "blockedReasons",
                List.of("收件人解析未就绪，provider 发送保持 dry-run")));

    OrganizationProvisioningCompletedNotificationConsumeResult result =
        consumerService.consume(request(payload(false)));

    assertThat(result.consumed()).isTrue();
    assertThat(result.status()).isEqualTo("success");
    @SuppressWarnings("unchecked")
    Map<String, Object> recipientPlan =
        (Map<String, Object>) result.sendPlan().get("recipientPlan");
    assertThat(recipientPlan)
        .containsEntry("recipientResolutionStatus", "blocked")
        .containsEntry("recipientCount", 0)
        .containsEntry("providerCallEnabled", false);
    assertThat((List<Object>) recipientPlan.get("blockedReasons"))
        .containsExactly("中心库收件人解析表未就绪: user");
    assertThat((Map<String, Object>) result.sendPlan().get("providerPlan"))
        .containsEntry("planStatus", "dry_run")
        .containsEntry("providerCallExecuted", false);
    verify(eventConsumeLogRepository).recordSuccess(any());
  }

  @Test
  void consumeSkipsDuplicateNotificationMessage() {
    when(eventConsumeLogRepository.recordSuccess(any())).thenReturn(false);

    OrganizationProvisioningCompletedNotificationConsumeResult result =
        consumerService.consume(request(payload(false)));

    assertThat(result.consumed()).isFalse();
    assertThat(result.duplicate()).isTrue();
    assertThat(result.reason()).isEqualTo("already_consumed");
    assertThat(result.status()).isEqualTo("duplicate");
    assertThat(result.sendPlanGenerated()).isFalse();
    assertThat(result.sendPlan()).isEmpty();
    verify(recipientPlanService, never()).buildPlan(anyInt(), any(), any(), any());
    verify(providerPlanService, never()).buildPlan(anyInt(), any(), any(), any(), any(), any());
  }

  @Test
  void consumeSkipsUnsupportedEventTypeWithoutWritingLog() {
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        consumerService.consume(
            new OrganizationProvisioningCompletedNotificationConsumeRequest(
                "evt_other",
                "other:1",
                "msg_other",
                "{}",
                "amount.bill.collection.sms",
                OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY));

    assertThat(result.status()).isEqualTo("skipped");
    assertThat(result.reason()).isEqualTo("unsupported_event_type");
    verify(eventConsumeLogRepository, never()).recordSuccess(any());
    verify(eventConsumeLogRepository, never()).recordFailure(any(), any());
    verify(recipientPlanService, never()).buildPlan(anyInt(), any(), any(), any());
    verify(providerPlanService, never()).buildPlan(anyInt(), any(), any(), any(), any(), any());
  }

  @Test
  void consumeRejectsMissingHeadersWithoutWritingLog() {
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        consumerService.consume(
            new OrganizationProvisioningCompletedNotificationConsumeRequest(
                null,
                "",
                null,
                payload(false),
                OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
                OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY));

    assertThat(result.status()).isEqualTo("invalid");
    assertThat(result.reason()).contains("missing_headers:eventId,idempotencyKey");
    verify(eventConsumeLogRepository, never()).recordSuccess(any());
    verify(eventConsumeLogRepository, never()).recordFailure(any(), any());
    verify(recipientPlanService, never()).buildPlan(anyInt(), any(), any(), any());
    verify(providerPlanService, never()).buildPlan(anyInt(), any(), any(), any(), any(), any());
  }

  @Test
  void consumeRecordsFailureForInvalidPayload() {
    when(eventConsumeLogRepository.recordFailure(any(), any())).thenReturn(true);

    OrganizationProvisioningCompletedNotificationConsumeResult result =
        consumerService.consume(request("{bad-json"));

    assertThat(result.consumed()).isFalse();
    assertThat(result.status()).isEqualTo("failed");
    assertThat(result.reason()).isEqualTo("invalid_payload");
    verify(eventConsumeLogRepository)
        .recordFailure(any(), org.mockito.ArgumentMatchers.contains("invalid payload"));
  }

  @Test
  void consumeRejectsProviderCallEnabled() {
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        consumerService.consume(request(payload(true)));

    assertThat(result.status()).isEqualTo("invalid");
    assertThat(result.reason()).isEqualTo("provider_call_enabled_not_supported");
    verify(eventConsumeLogRepository, never()).recordSuccess(any());
    verify(recipientPlanService, never()).buildPlan(anyInt(), any(), any(), any());
    verify(providerPlanService, never()).buildPlan(anyInt(), any(), any(), any(), any(), any());
  }

  @Test
  void consumeRejectsProviderCallEnabledStringValue() {
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        consumerService.consume(request(payload("\"true\"")));

    assertThat(result.status()).isEqualTo("invalid");
    assertThat(result.reason()).isEqualTo("provider_call_enabled_not_supported");
    verify(eventConsumeLogRepository, never()).recordSuccess(any());
    verify(recipientPlanService, never()).buildPlan(anyInt(), any(), any(), any());
    verify(providerPlanService, never()).buildPlan(anyInt(), any(), any(), any(), any(), any());
  }

  private OrganizationProvisioningCompletedNotificationConsumeRequest request(String payload) {
    return new OrganizationProvisioningCompletedNotificationConsumeRequest(
        "evt_notification_31",
        "organization-provisioning-completed-notification:31",
        "organization-provisioning-completed-notification-31",
        payload,
        OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
        OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
  }

  private String payload(boolean providerCallEnabled) {
    return payload(String.valueOf(providerCallEnabled));
  }

  private String payload(String providerCallEnabled) {
    return """
        {
          "jobId": 31,
          "targetCustomerId": "org001",
          "targetDbName": "tenant_org001",
          "templateKey": "organization_provisioning_completed",
          "channels": ["in_app", "wechat_work", "sms"],
          "providerCallEnabled": %s
        }
        """
        .formatted(providerCallEnabled);
  }
}

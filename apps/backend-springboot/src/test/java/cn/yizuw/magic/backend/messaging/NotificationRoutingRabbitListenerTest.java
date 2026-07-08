package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;

/** 通用 notification listener 测试；确认只在委托矩阵通过后调用专用 consumer。 */
class NotificationRoutingRabbitListenerTest {

  private NotificationRoutingRabbitListener listener;
  private NotificationConsumerDelegationPlanService consumerDelegationPlanService;
  private OrganizationProvisioningCompletedNotificationConsumerService
      organizationNotificationConsumerService;
  private NotificationAdapterRequestValidationPlanService requestValidationPlanService;
  private NotificationHandlerAdapterPlanService adapterPlanService;
  private NotificationDispatchPreflightService dispatchPreflightService;
  private NotificationRoutingPlanService routingPlanService;
  private NotificationInAppProviderListenerNoopPlanService listenerNoopPlanService;
  private NotificationInAppProviderConsumerResultClassificationBridgeService
      consumerResultClassificationBridgeService;
  private NotificationInAppProviderBridgeReturnThrowDecisionDryRunService
      bridgeReturnThrowDecisionDryRunService;
  private NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService
      observationLogPayloadDryRunService;
  private NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService
      observationLogDryRunService;
  private NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService
      observationLogMessageDryRunService;
  private NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService
      observationLoggerInvocationDryRunService;
  private NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService
      observationLoggerExecutionPlanService;
  private NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService
      observationEventConsumeLogWritePlanService;
  private NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService
      observationEventConsumeLogRepositoryIntegrationPlanService;
  private NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService
      observationEventConsumeLogRepositoryCallPlanService;
  private NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService
      observationEventConsumeLogRecordSuccessExecutionGatePlanService;
  private NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService
      observationEventConsumeLogRecordSuccessExecutionSwitchPlanService;
  private NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService
      observationEventConsumeLogRecordSuccessExecutionAdapterPlanService;

  @BeforeEach
  void setUp() {
    consumerDelegationPlanService =
        org.mockito.Mockito.mock(NotificationConsumerDelegationPlanService.class);
    organizationNotificationConsumerService =
        org.mockito.Mockito.mock(OrganizationProvisioningCompletedNotificationConsumerService.class);
    requestValidationPlanService =
        org.mockito.Mockito.mock(NotificationAdapterRequestValidationPlanService.class);
    adapterPlanService = org.mockito.Mockito.mock(NotificationHandlerAdapterPlanService.class);
    dispatchPreflightService = org.mockito.Mockito.mock(NotificationDispatchPreflightService.class);
    routingPlanService = org.mockito.Mockito.mock(NotificationRoutingPlanService.class);
    listenerNoopPlanService =
        org.mockito.Mockito.mock(NotificationInAppProviderListenerNoopPlanService.class);
    consumerResultClassificationBridgeService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderConsumerResultClassificationBridgeService.class);
    bridgeReturnThrowDecisionDryRunService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderBridgeReturnThrowDecisionDryRunService.class);
    observationLogPayloadDryRunService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService
                .class);
    observationLogDryRunService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService.class);
    observationLogMessageDryRunService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService
                .class);
    observationLoggerInvocationDryRunService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService
                .class);
    observationLoggerExecutionPlanService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService
                .class);
    observationEventConsumeLogWritePlanService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService
                .class);
    observationEventConsumeLogRepositoryIntegrationPlanService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService
                .class);
    observationEventConsumeLogRepositoryCallPlanService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService
                .class);
    observationEventConsumeLogRecordSuccessExecutionGatePlanService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService
                .class);
    observationEventConsumeLogRecordSuccessExecutionSwitchPlanService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService
                .class);
    observationEventConsumeLogRecordSuccessExecutionAdapterPlanService =
        org.mockito.Mockito.mock(
            NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService
                .class);
    listener =
        new NotificationRoutingRabbitListener(
            routingPlanService,
            dispatchPreflightService,
            adapterPlanService,
            requestValidationPlanService,
            consumerDelegationPlanService,
            organizationNotificationConsumerService,
            listenerNoopPlanService,
            consumerResultClassificationBridgeService,
            bridgeReturnThrowDecisionDryRunService,
            observationLogPayloadDryRunService,
            observationLogDryRunService,
            observationLogMessageDryRunService,
            observationLoggerInvocationDryRunService,
            observationLoggerExecutionPlanService,
            observationEventConsumeLogWritePlanService,
            observationEventConsumeLogRepositoryIntegrationPlanService,
            observationEventConsumeLogRepositoryCallPlanService,
            observationEventConsumeLogRecordSuccessExecutionGatePlanService,
            observationEventConsumeLogRecordSuccessExecutionSwitchPlanService,
            observationEventConsumeLogRecordSuccessExecutionAdapterPlanService);
  }

  @Test
  void onMessageBuildsConsumerDelegationPlanAndThrowsWhenDelegationIsBlocked() {
    Message message =
        message(
            "{\"source\":\"contract_reminder_sms\"}",
            "msg-route-1",
            "evt-route-1",
            "contract-reminder-sms:1",
            "contract_reminder_sms",
            "contract_reminder_sms");
    Map<String, Object> routingPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
            "routeSupported",
            true,
            "handlerBean",
            "contractReminderSmsNotificationConsumer");
    Map<String, Object> dispatchPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
            "dispatchAllowed",
            false);
    Map<String, Object> adapterPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
            "adapterInvocationAllowed",
            false);
    Map<String, Object> requestValidationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
            "requestValidationPassed",
            false);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS,
            "delegationAllowed",
            false,
            "delegationReadinessFailedChecks",
            List.of("route_supported"),
            "nextAction",
            "fix_blocked_readiness_checks_before_real_delegation");
    mockPlanPipeline(
        "{\"source\":\"contract_reminder_sms\"}",
        routingPlan,
        dispatchPlan,
        adapterPlan,
        requestValidationPlan,
        delegationPlan);

    assertThatThrownBy(() -> listener.onMessage(message))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("notification consumer delegation blocked")
        .hasMessageContaining("message remains unconfirmed")
        .hasMessageContaining(NotificationRoutingPlanService.ROUTE_CONTRACT_REMINDER_SMS)
        .hasMessageContaining("delegationAllowed=false")
        .hasMessageContaining("failedChecks=[route_supported]")
        .hasMessageContaining("nextAction=fix_blocked_readiness_checks_before_real_delegation");

    verify(organizationNotificationConsumerService, never()).consume(any());
    verify(listenerNoopPlanService, never()).buildPlan(anyBoolean());
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> headersCaptor = ArgumentCaptor.forClass(Map.class);
    verify(routingPlanService)
        .buildPlan(
            eq("msg-route-1"),
            headersCaptor.capture(),
            eq("{\"source\":\"contract_reminder_sms\"}"));
    verify(dispatchPreflightService).buildPlan(routingPlan);
    verify(adapterPlanService)
        .buildPlan(routingPlan, dispatchPlan, "{\"source\":\"contract_reminder_sms\"}");
    verify(requestValidationPlanService)
        .buildPlan(routingPlan, adapterPlan, "{\"source\":\"contract_reminder_sms\"}");
    verify(consumerDelegationPlanService)
        .buildPlan(routingPlan, requestValidationPlan, "{\"source\":\"contract_reminder_sms\"}");
    assertThat(headersCaptor.getValue())
        .containsEntry("eventId", "evt-route-1")
        .containsEntry("idempotencyKey", "contract-reminder-sms:1")
        .containsEntry("eventType", "contract_reminder_sms")
        .containsEntry("templateKey", "contract_reminder_sms");
  }

  @Test
  void onMessageDelegatesOrganizationNotificationAndReturnsWhenResultIsAckable() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "routeSupported",
            true,
            "handlerBean",
            "organizationProvisioningCompletedNotificationConsumerService");
    Map<String, Object> dispatchPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "dispatchAllowed",
            true);
    Map<String, Object> adapterPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "adapterInvocationAllowed",
            true);
    Map<String, Object> requestValidationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "requestValidationPassed",
            true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any()))
        .thenReturn(
            new OrganizationProvisioningCompletedNotificationConsumeResult(
                true,
                false,
                "evt_notification_31",
                "organization-provisioning-completed-notification:31",
                31,
                Map.of("sendEnabled", false, "providerCallEnabled", false),
                true,
                "notification_send_plan_generated",
                "success",
                "org001",
                "tenant_org001"));

    listener.onMessage(message);

    ArgumentCaptor<OrganizationProvisioningCompletedNotificationConsumeRequest> captor =
        ArgumentCaptor.forClass(OrganizationProvisioningCompletedNotificationConsumeRequest.class);
    verify(organizationNotificationConsumerService).consume(captor.capture());
    OrganizationProvisioningCompletedNotificationConsumeRequest request = captor.getValue();
    assertThat(request.eventId()).isEqualTo("evt_notification_31");
    assertThat(request.idempotencyKey())
        .isEqualTo("organization-provisioning-completed-notification:31");
    assertThat(request.messageId()).isEqualTo("msg_notification_31");
    assertThat(request.payload()).isEqualTo(payload);
    assertThat(request.eventType())
        .isEqualTo(OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE);
    assertThat(request.templateKey())
        .isEqualTo(OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    verify(listenerNoopPlanService).buildPlan(false);
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
  }

  @Test
  void onMessageReturnsWhenDedicatedConsumerReportsDuplicate() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any()))
        .thenReturn(
            new OrganizationProvisioningCompletedNotificationConsumeResult(
                false,
                true,
                "evt_notification_31",
                "organization-provisioning-completed-notification:31",
                31,
                Map.of(),
                false,
                "already_consumed",
                "duplicate",
                "org001",
                "tenant_org001"));

    listener.onMessage(message);

    verify(organizationNotificationConsumerService).consume(any());
    verify(listenerNoopPlanService).buildPlan(false);
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
  }

  @Test
  void onMessageThrowsWhenDedicatedConsumerReturnsNonAckableResult() {
    String payload = "{\"jobId\":31,\"providerCallEnabled\":true}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any()))
        .thenReturn(
            new OrganizationProvisioningCompletedNotificationConsumeResult(
                false,
                false,
                "evt_notification_31",
                "organization-provisioning-completed-notification:31",
                null,
                Map.of(),
                false,
                "provider_call_enabled_not_supported",
                "invalid",
                null,
                null));

    assertThatThrownBy(() -> listener.onMessage(message))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("notification dedicated consumer returned non-ackable result")
        .hasMessageContaining("status=invalid")
        .hasMessageContaining("provider_call_enabled_not_supported")
        .hasMessageContaining("evt_notification_31");
    verify(organizationNotificationConsumerService).consume(any());
    verify(listenerNoopPlanService, never()).buildPlan(anyBoolean());
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
  }

  @Test
  void onMessageBuildsListenerNoopPlanWhenAckableAndAdapterPlanIsReady() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any()))
        .thenReturn(
            new OrganizationProvisioningCompletedNotificationConsumeResult(
                true,
                false,
                "evt_notification_31",
                "organization-provisioning-completed-notification:31",
                31,
                Map.of(),
                true,
                "notification_send_plan_generated",
                "success",
                "org001",
                "tenant_org001"));

    listener.onMessage(message);

    verify(listenerNoopPlanService).buildPlan(true);
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
  }

  @Test
  void onMessageInvokesClassificationBridgeDryRunWhenConsumedAndBridgeGateReady() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        new OrganizationProvisioningCompletedNotificationConsumeResult(
            true,
            false,
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            31,
            Map.of("providerPlan", Map.of()),
            true,
            "notification_send_plan_generated",
            "success",
            "org001",
            "tenant_org001");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any())).thenReturn(result);
    when(listenerNoopPlanService.buildPlan(true)).thenReturn(listenerNoopPlan(true));

    listener.onMessage(message);

    verify(listenerNoopPlanService).buildPlan(true);
    verify(consumerResultClassificationBridgeService).classifyDryRun(result);
  }

  @Test
  void onMessageKeepsReturnPolicyWhenBridgeDryRunReportsFutureThrowDecision() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        new OrganizationProvisioningCompletedNotificationConsumeResult(
            true,
            false,
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            31,
            Map.of("providerPlan", Map.of()),
            true,
            "notification_send_plan_generated",
            "success",
            "org001",
            "tenant_org001");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any())).thenReturn(result);
    when(listenerNoopPlanService.buildPlan(true)).thenReturn(listenerNoopPlan(true));
    when(consumerResultClassificationBridgeService.classifyDryRun(result))
        .thenReturn(
            Map.of(
                "classificationStatus",
                "blocked",
                "futureReturnThrowDecision",
                "throw_for_retry_or_dlq_until_real_policy_batch",
                "rabbitAckExecuted",
                false,
                "rabbitNackExecuted",
                false));

    listener.onMessage(message);

    verify(listenerNoopPlanService).buildPlan(true);
    verify(consumerResultClassificationBridgeService).classifyDryRun(result);
  }

  @Test
  void onMessageKeepsReturnPolicyWhenReturnThrowPolicyGateIsReadyButSwitchNotIntegrated() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        new OrganizationProvisioningCompletedNotificationConsumeResult(
            true,
            false,
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            31,
            Map.of("providerPlan", Map.of()),
            true,
            "notification_send_plan_generated",
            "success",
            "org001",
            "tenant_org001");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any())).thenReturn(result);
    when(listenerNoopPlanService.buildPlan(true))
        .thenReturn(listenerNoopPlanWithReturnThrowPolicyGate(true, true));
    when(consumerResultClassificationBridgeService.classifyDryRun(result))
        .thenReturn(
            Map.of(
                "classificationStatus",
                "blocked",
                "futureReturnThrowDecision",
                "throw_for_retry_or_dlq_until_real_policy_batch",
                "returnThrowPolicyChangeAllowed",
                true,
                "rabbitAckExecuted",
                false,
                "rabbitNackExecuted",
                false));

    listener.onMessage(message);

    verify(listenerNoopPlanService).buildPlan(true);
    verify(consumerResultClassificationBridgeService).classifyDryRun(result);
    verify(bridgeReturnThrowDecisionDryRunService, never()).decideDryRun(any(), any());
  }

  @Test
  void onMessageInvokesReadOnlyDecisionDryRunWhenDecisionGateIsReady() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        new OrganizationProvisioningCompletedNotificationConsumeResult(
            true,
            false,
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            31,
            Map.of("providerPlan", Map.of()),
            true,
            "notification_send_plan_generated",
            "success",
            "org001",
            "tenant_org001");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any())).thenReturn(result);
    when(listenerNoopPlanService.buildPlan(true))
        .thenReturn(listenerNoopPlanWithDecisionDryRunGate(true, true, true, true));
    Map<String, Object> decisionDryRunPlan =
        Map.of(
            "planStatus",
            "ready_for_listener_return_throw_decision_dry_run",
            "decisionOutputObservationPlan",
            Map.of("logMessageKey", "notification.in_app_provider.bridge_return_throw_decision_dry_run"));
    when(bridgeReturnThrowDecisionDryRunService.decideDryRun(eq(result), any()))
        .thenReturn(decisionDryRunPlan);
    Map<String, Object> payloadDryRunPlan =
        Map.of(
            "payloadBuildExecuted",
            true,
            "payloadPreview",
            Map.of("eventId", "evt_notification_31"));
    when(observationLogPayloadDryRunService.buildDryRun(eq(result), eq(decisionDryRunPlan), any()))
        .thenReturn(payloadDryRunPlan);

    listener.onMessage(message);

    ArgumentCaptor<Map<String, Object>> policyGateCaptor = ArgumentCaptor.forClass(Map.class);
    ArgumentCaptor<Map<String, Object>> loggingGateCaptor = ArgumentCaptor.forClass(Map.class);
    ArgumentCaptor<Map<String, Object>> observationLoggingGateCaptor =
        ArgumentCaptor.forClass(Map.class);
    verify(listenerNoopPlanService).buildPlan(true);
    verify(bridgeReturnThrowDecisionDryRunService)
        .decideDryRun(eq(result), policyGateCaptor.capture());
    verify(observationLogPayloadDryRunService)
        .buildDryRun(eq(result), eq(decisionDryRunPlan), loggingGateCaptor.capture());
    verify(observationLogDryRunService)
        .buildDryRun(eq(payloadDryRunPlan), observationLoggingGateCaptor.capture());
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
    assertThat(policyGateCaptor.getValue())
        .containsEntry("returnThrowPolicyChangeAllowed", true);
    assertThat(loggingGateCaptor.getValue()).containsEntry("observationLoggingAllowed", true);
    assertThat(observationLoggingGateCaptor.getValue())
        .containsEntry("observationLoggingAllowed", true);
  }

  @Test
  void onMessageUsesDecisionDryRunOutputOnlyForPayloadDryRunAndKeepsReturnPolicy() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        new OrganizationProvisioningCompletedNotificationConsumeResult(
            true,
            false,
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            31,
            Map.of("providerPlan", Map.of()),
            true,
            "notification_send_plan_generated",
            "success",
            "org001",
            "tenant_org001");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any())).thenReturn(result);
    when(listenerNoopPlanService.buildPlan(true))
        .thenReturn(listenerNoopPlanWithDecisionDryRunGate(true, true, true, true));
    Map<String, Object> decisionDryRunPlan =
        Map.of(
            "planStatus",
            "ready_for_listener_return_throw_decision_dry_run",
            "policyDecisionPlan",
            Map.of(
                "futureListenerDecision",
                "throw_for_retry_or_dlq_until_real_policy_batch",
                "decisionApplied",
                false),
            "decisionOutputObservationPlan",
            Map.of("logMessageKey", "notification.in_app_provider.bridge_return_throw_decision_dry_run"),
            "throwRequested",
            false,
            "rabbitAckExecuted",
            false,
            "rabbitNackExecuted",
            false);
    when(bridgeReturnThrowDecisionDryRunService.decideDryRun(eq(result), any()))
        .thenReturn(decisionDryRunPlan);
    Map<String, Object> payloadDryRunPlan =
        Map.of("payloadBuildExecuted", true, "payloadPreview", Map.of("eventId", "evt_notification_31"));
    when(observationLogPayloadDryRunService.buildDryRun(eq(result), eq(decisionDryRunPlan), any()))
        .thenReturn(payloadDryRunPlan);

    listener.onMessage(message);

    verify(listenerNoopPlanService).buildPlan(true);
    verify(bridgeReturnThrowDecisionDryRunService).decideDryRun(eq(result), any());
    verify(observationLogPayloadDryRunService)
        .buildDryRun(eq(result), eq(decisionDryRunPlan), any());
    verify(observationLogDryRunService).buildDryRun(eq(payloadDryRunPlan), any());
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
  }

  @Test
  void onMessageInvokesPayloadDryRunWithBlockedLoggingGateAndKeepsReturnPolicy() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        new OrganizationProvisioningCompletedNotificationConsumeResult(
            true,
            false,
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            31,
            Map.of("providerPlan", Map.of()),
            true,
            "notification_send_plan_generated",
            "success",
            "org001",
            "tenant_org001");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any())).thenReturn(result);
    when(listenerNoopPlanService.buildPlan(true))
        .thenReturn(listenerNoopPlanWithDecisionDryRunGate(true, true, true, false));
    Map<String, Object> decisionDryRunPlan =
        Map.of(
            "planStatus",
            "ready_for_listener_return_throw_decision_dry_run",
            "decisionOutputObservationPlan",
            Map.of("logMessageKey", "notification.in_app_provider.bridge_return_throw_decision_dry_run"));
    when(bridgeReturnThrowDecisionDryRunService.decideDryRun(eq(result), any()))
        .thenReturn(decisionDryRunPlan);
    Map<String, Object> payloadDryRunPlan =
        Map.of("payloadBuildExecuted", false, "payloadPreview", Map.of());
    when(observationLogPayloadDryRunService.buildDryRun(eq(result), eq(decisionDryRunPlan), any()))
        .thenReturn(payloadDryRunPlan);

    listener.onMessage(message);

    ArgumentCaptor<Map<String, Object>> loggingGateCaptor = ArgumentCaptor.forClass(Map.class);
    verify(bridgeReturnThrowDecisionDryRunService).decideDryRun(eq(result), any());
    verify(observationLogPayloadDryRunService)
        .buildDryRun(eq(result), eq(decisionDryRunPlan), loggingGateCaptor.capture());
    verify(observationLogDryRunService).buildDryRun(eq(payloadDryRunPlan), any());
    assertThat(loggingGateCaptor.getValue())
        .containsEntry("observationLoggingAllowed", false)
        .containsEntry("logExecuted", false)
        .containsEntry("databaseWriteExecuted", false)
        .containsEntry("rabbitAckExecuted", false)
        .containsEntry("rabbitNackExecuted", false);
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
  }

  @Test
  void onMessageIgnoresPayloadDryRunOutputAndKeepsReturnPolicy() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        new OrganizationProvisioningCompletedNotificationConsumeResult(
            true,
            false,
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            31,
            Map.of("providerPlan", Map.of()),
            true,
            "notification_send_plan_generated",
            "success",
            "org001",
            "tenant_org001");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any())).thenReturn(result);
    when(listenerNoopPlanService.buildPlan(true))
        .thenReturn(listenerNoopPlanWithDecisionDryRunGate(true, true, true, true));
    Map<String, Object> decisionDryRunPlan =
        Map.of(
            "planStatus",
            "ready_for_listener_return_throw_decision_dry_run",
            "decisionOutputObservationPlan",
            Map.of("logMessageKey", "notification.in_app_provider.bridge_return_throw_decision_dry_run"));
    when(bridgeReturnThrowDecisionDryRunService.decideDryRun(eq(result), any()))
        .thenReturn(decisionDryRunPlan);
    when(observationLogPayloadDryRunService.buildDryRun(eq(result), eq(decisionDryRunPlan), any()))
        .thenReturn(
            Map.of(
                "payloadBuildExecuted",
                true,
                "payloadPreview",
                Map.of("eventId", "evt_notification_31"),
                "throwRequested",
                true,
                "rabbitNackExecuted",
                true));

    listener.onMessage(message);

    verify(bridgeReturnThrowDecisionDryRunService).decideDryRun(eq(result), any());
    verify(observationLogPayloadDryRunService).buildDryRun(eq(result), eq(decisionDryRunPlan), any());
    verify(observationLogDryRunService)
        .buildDryRun(
            argThat(
                plan ->
                    Boolean.TRUE.equals(plan.get("payloadBuildExecuted"))
                        && Boolean.TRUE.equals(plan.get("throwRequested"))
                        && Boolean.TRUE.equals(plan.get("rabbitNackExecuted"))),
            any());
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
  }

  @Test
  void onMessageIgnoresObservationLogDryRunOutputAndKeepsReturnPolicy() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        new OrganizationProvisioningCompletedNotificationConsumeResult(
            true,
            false,
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            31,
            Map.of("providerPlan", Map.of()),
            true,
            "notification_send_plan_generated",
            "success",
            "org001",
            "tenant_org001");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any())).thenReturn(result);
    when(listenerNoopPlanService.buildPlan(true))
        .thenReturn(listenerNoopPlanWithDecisionDryRunGate(true, true, true, true));
    Map<String, Object> decisionDryRunPlan =
        Map.of(
            "planStatus",
            "ready_for_listener_return_throw_decision_dry_run",
            "decisionOutputObservationPlan",
            Map.of("logMessageKey", "notification.in_app_provider.bridge_return_throw_decision_dry_run"));
    Map<String, Object> payloadDryRunPlan =
        Map.of(
            "payloadBuildExecuted",
            true,
            "payloadPreview",
            Map.of("eventId", "evt_notification_31"));
    when(bridgeReturnThrowDecisionDryRunService.decideDryRun(eq(result), any()))
        .thenReturn(decisionDryRunPlan);
    when(observationLogPayloadDryRunService.buildDryRun(eq(result), eq(decisionDryRunPlan), any()))
        .thenReturn(payloadDryRunPlan);
    Map<String, Object> observationLogDryRunPlan =
        Map.of(
            "logPlanned",
            true,
            "logPayloadPreview",
            Map.of("eventId", "evt_notification_31"),
            "logExecuted",
            true,
            "databaseWriteExecuted",
            true,
            "rabbitNackExecuted",
            true);
    when(observationLogDryRunService.buildDryRun(eq(payloadDryRunPlan), any()))
        .thenReturn(observationLogDryRunPlan);

    listener.onMessage(message);

    verify(bridgeReturnThrowDecisionDryRunService).decideDryRun(eq(result), any());
    verify(observationLogPayloadDryRunService)
        .buildDryRun(eq(result), eq(decisionDryRunPlan), any());
    verify(observationLogDryRunService).buildDryRun(eq(payloadDryRunPlan), any());
    verify(observationLogMessageDryRunService).buildDryRun(eq(observationLogDryRunPlan));
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
  }

  @Test
  void onMessageIgnoresObservationLogMessageDryRunOutputAndKeepsReturnPolicy() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        new OrganizationProvisioningCompletedNotificationConsumeResult(
            true,
            false,
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            31,
            Map.of("providerPlan", Map.of()),
            true,
            "notification_send_plan_generated",
            "success",
            "org001",
            "tenant_org001");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any())).thenReturn(result);
    when(listenerNoopPlanService.buildPlan(true))
        .thenReturn(listenerNoopPlanWithDecisionDryRunGate(true, true, true, true));
    Map<String, Object> decisionDryRunPlan =
        Map.of(
            "planStatus",
            "ready_for_listener_return_throw_decision_dry_run",
            "decisionOutputObservationPlan",
            Map.of("logMessageKey", "notification.in_app_provider.bridge_return_throw_decision_dry_run"));
    Map<String, Object> payloadDryRunPlan =
        Map.of(
            "payloadBuildExecuted",
            true,
            "payloadPreview",
            Map.of("eventId", "evt_notification_31"));
    Map<String, Object> observationLogDryRunPlan =
        Map.of(
            "logPlanned",
            true,
            "logPayloadPreview",
            Map.of("eventId", "evt_notification_31"),
            "logMessageKey",
            "notification.in_app_provider.bridge_return_throw_decision_dry_run");
    Map<String, Object> messageDryRunPlan =
        Map.of(
            "formattedMessagePreview",
            "would log",
            "messageFormattingPreviewGenerated",
            true,
            "loggerInvocationExecuted",
            true,
            "logExecuted",
            true,
            "databaseWriteExecuted",
            true,
            "rabbitNackExecuted",
            true);
    when(bridgeReturnThrowDecisionDryRunService.decideDryRun(eq(result), any()))
        .thenReturn(decisionDryRunPlan);
    when(observationLogPayloadDryRunService.buildDryRun(eq(result), eq(decisionDryRunPlan), any()))
        .thenReturn(payloadDryRunPlan);
    when(observationLogDryRunService.buildDryRun(eq(payloadDryRunPlan), any()))
        .thenReturn(observationLogDryRunPlan);
    when(observationLogMessageDryRunService.buildDryRun(eq(observationLogDryRunPlan)))
        .thenReturn(messageDryRunPlan);

    listener.onMessage(message);

    verify(bridgeReturnThrowDecisionDryRunService).decideDryRun(eq(result), any());
    verify(observationLogPayloadDryRunService)
        .buildDryRun(eq(result), eq(decisionDryRunPlan), any());
    verify(observationLogDryRunService).buildDryRun(eq(payloadDryRunPlan), any());
    verify(observationLogMessageDryRunService).buildDryRun(eq(observationLogDryRunPlan));
    verify(observationLoggerInvocationDryRunService)
        .buildDryRun(
            eq(messageDryRunPlan),
            argThat(gate -> Boolean.TRUE.equals(gate.get("loggerInvocationAllowed"))));
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
  }

  @Test
  void onMessageKeepsReturnPolicyAfterGatedLoggerExecutionPlan() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        new OrganizationProvisioningCompletedNotificationConsumeResult(
            true,
            false,
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            31,
            Map.of("providerPlan", Map.of()),
            true,
            "notification_send_plan_generated",
            "success",
            "org001",
            "tenant_org001");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any())).thenReturn(result);
    when(listenerNoopPlanService.buildPlan(true))
        .thenReturn(listenerNoopPlanWithDecisionDryRunGate(true, true, true, true));
    Map<String, Object> decisionDryRunPlan =
        Map.of(
            "planStatus",
            "ready_for_listener_return_throw_decision_dry_run",
            "decisionOutputObservationPlan",
            Map.of("logMessageKey", "notification.in_app_provider.bridge_return_throw_decision_dry_run"));
    Map<String, Object> payloadDryRunPlan =
        Map.of(
            "payloadBuildExecuted",
            true,
            "payloadPreview",
            Map.of("eventId", "evt_notification_31"));
    Map<String, Object> observationLogDryRunPlan =
        Map.of(
            "logPlanned",
            true,
            "logPayloadPreview",
            Map.of("eventId", "evt_notification_31"),
            "logMessageKey",
            "notification.in_app_provider.bridge_return_throw_decision_dry_run");
    Map<String, Object> messageDryRunPlan =
        Map.of(
            "formattedMessagePreview",
            "would log",
            "messageFormattingPreviewGenerated",
            true);
    when(bridgeReturnThrowDecisionDryRunService.decideDryRun(eq(result), any()))
        .thenReturn(decisionDryRunPlan);
    when(observationLogPayloadDryRunService.buildDryRun(eq(result), eq(decisionDryRunPlan), any()))
        .thenReturn(payloadDryRunPlan);
    when(observationLogDryRunService.buildDryRun(eq(payloadDryRunPlan), any()))
        .thenReturn(observationLogDryRunPlan);
    when(observationLogMessageDryRunService.buildDryRun(eq(observationLogDryRunPlan)))
        .thenReturn(messageDryRunPlan);
    Map<String, Object> loggerInvocationDryRunPlan =
        Map.of(
            "loggerInvocationPlanned",
            true,
            "loggerNamePreview",
            "NotificationRoutingRabbitListener",
            "logLevelPreview",
            "INFO",
            "loggerInvocationExecuted",
            true,
            "logExecuted",
            true,
            "databaseWriteExecuted",
            true,
            "rabbitNackExecuted",
            true);
    when(observationLoggerInvocationDryRunService.buildDryRun(eq(messageDryRunPlan), any()))
        .thenReturn(loggerInvocationDryRunPlan);
    Map<String, Object> loggerExecutionPlan =
        Map.of(
            "loggerExecutionPlanned",
            true,
            "allowedLogLevel",
            "INFO",
            "allowedMessageSource",
            "formattedMessagePreview",
            "formattedMessagePreview",
            "would log",
            "loggerInvocationExecuted",
            true,
            "logExecuted",
            true,
            "databaseWriteExecuted",
            true,
            "rabbitNackExecuted",
            true);
    when(observationLoggerExecutionPlanService.buildPlan(eq(loggerInvocationDryRunPlan), any()))
        .thenReturn(loggerExecutionPlan);
    Map<String, Object> eventConsumeLogWritePlan =
        Map.of(
            "databaseWritePlanned",
            true,
            "targetTable",
            "event_consume_log",
            "databaseWriteExecuted",
            true,
            "sqlExecuted",
            true,
            "rabbitNackExecuted",
            true);
    when(observationEventConsumeLogWritePlanService.buildPlan(eq(loggerExecutionPlan), any()))
        .thenReturn(eventConsumeLogWritePlan);
    Map<String, Object> repositoryIntegrationPlan =
        Map.of(
            "repositoryIntegrationPlanned",
            true,
            "repositoryInvoked",
            true,
            "databaseWriteExecuted",
            true,
            "sqlExecuted",
            true,
            "rabbitNackExecuted",
            true);
    when(observationEventConsumeLogRepositoryIntegrationPlanService.buildPlan(
            eq(eventConsumeLogWritePlan), any()))
        .thenReturn(repositoryIntegrationPlan);
    Map<String, Object> repositoryCallPlan =
        Map.of(
            "repositoryCallPlanned",
            true,
            "repositoryInvoked",
            true,
            "databaseWriteExecuted",
            true,
            "sqlExecuted",
            true,
            "rabbitNackExecuted",
            true);
    when(observationEventConsumeLogRepositoryCallPlanService.buildPlan(eq(repositoryIntegrationPlan)))
        .thenReturn(repositoryCallPlan);
    Map<String, Object> recordSuccessExecutionGatePlan =
        Map.of(
            "recordSuccessExecutionPlanned",
            true,
            "repositoryInvoked",
            true,
            "insertedResultObserved",
            true,
            "databaseWriteExecuted",
            true,
            "sqlExecuted",
            true,
            "rabbitNackExecuted",
            true);
    when(observationEventConsumeLogRecordSuccessExecutionGatePlanService.buildPlan(
            eq(repositoryCallPlan), any()))
        .thenReturn(recordSuccessExecutionGatePlan);
    when(observationEventConsumeLogRecordSuccessExecutionSwitchPlanService.buildPlan(
            eq(recordSuccessExecutionGatePlan), any()))
        .thenReturn(
            Map.of(
                "recordSuccessExecutionAdapterPlanned",
                true,
                "repositoryInvoked",
                true,
                "insertedResultObserved",
                true,
                "databaseWriteExecuted",
                true,
                "sqlExecuted",
                true,
                "rabbitNackExecuted",
                true));
    Map<String, Object> recordSuccessExecutionAdapterPlan =
        Map.of("recordSuccessExecutionAdapterAllowed", false);
    when(observationEventConsumeLogRecordSuccessExecutionAdapterPlanService.buildPlan(
            any(), any()))
        .thenReturn(recordSuccessExecutionAdapterPlan);

    listener.onMessage(message);

    verify(bridgeReturnThrowDecisionDryRunService).decideDryRun(eq(result), any());
    verify(observationLogPayloadDryRunService)
        .buildDryRun(eq(result), eq(decisionDryRunPlan), any());
    verify(observationLogDryRunService).buildDryRun(eq(payloadDryRunPlan), any());
    verify(observationLogMessageDryRunService).buildDryRun(eq(observationLogDryRunPlan));
    verify(observationLoggerInvocationDryRunService)
        .buildDryRun(
            eq(messageDryRunPlan),
            argThat(gate -> Boolean.TRUE.equals(gate.get("loggerInvocationAllowed"))));
    verify(observationLoggerExecutionPlanService)
        .buildPlan(
            eq(loggerInvocationDryRunPlan),
            argThat(gate -> Boolean.TRUE.equals(gate.get("loggerExecutionAllowed"))));
    verify(observationEventConsumeLogWritePlanService)
        .buildPlan(
            eq(loggerExecutionPlan),
            argThat(gate -> Boolean.TRUE.equals(gate.get("eventConsumeLogWriteAllowed"))));
    verify(observationEventConsumeLogRepositoryIntegrationPlanService)
        .buildPlan(
            eq(eventConsumeLogWritePlan),
            argThat(
                metadata ->
                    "notification-in-app-provider-observation"
                            .equals(metadata.get("consumerGroup"))
                        && "evt_notification_31".equals(metadata.get("eventId"))
                        && OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE
                            .equals(metadata.get("eventType"))
                        && "organization-provisioning-completed-notification:31"
                            .equals(metadata.get("idempotencyKey"))
                        && "magic.notification.queue".equals(metadata.get("topic"))));
    verify(observationEventConsumeLogRepositoryCallPlanService)
        .buildPlan(eq(repositoryIntegrationPlan));
    verify(observationEventConsumeLogRecordSuccessExecutionGatePlanService)
        .buildPlan(
            eq(repositoryCallPlan),
            argThat(gate -> Boolean.FALSE.equals(gate.get("recordSuccessExecutionAllowed"))));
    verify(observationEventConsumeLogRecordSuccessExecutionSwitchPlanService)
        .buildPlan(
            eq(recordSuccessExecutionGatePlan),
            argThat(
                gate ->
                    "RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED"
                            .equals(gate.get("recordSuccessExecutionSwitchProperty"))
                        && Boolean.FALSE.equals(
                            gate.get("recordSuccessExecutionSwitchAllowed"))));
    verify(observationEventConsumeLogRecordSuccessExecutionAdapterPlanService)
        .buildPlan(
            any(),
            argThat(
                adapter ->
                    Boolean.FALSE.equals(
                        adapter.get("recordSuccessExecutionAdapterAllowed"))));
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
  }

  @Test
  void onMessageSkipsLoggerWhenExecutionPlanIsNotGatedForInfoFormattedMessage() {
    assertThat(
            captureInfoMessagesForLoggerExecutionPlan(
                Map.of(
                    "loggerExecutionPlanned",
                    false,
                    "allowedLogLevel",
                    "INFO",
                    "allowedMessageSource",
                    "formattedMessagePreview",
                    "formattedMessagePreview",
                    "would not log")))
        .isEmpty();
    assertThat(
            captureInfoMessagesForLoggerExecutionPlan(
                Map.of(
                    "loggerExecutionPlanned",
                    true,
                    "allowedLogLevel",
                    "WARN",
                    "allowedMessageSource",
                    "formattedMessagePreview",
                    "formattedMessagePreview",
                    "would not log")))
        .isEmpty();
    assertThat(
            captureInfoMessagesForLoggerExecutionPlan(
                Map.of(
                    "loggerExecutionPlanned",
                    true,
                    "allowedLogLevel",
                    "INFO",
                    "allowedMessageSource",
                    "rawMessage",
                    "formattedMessagePreview",
                    "would not log")))
        .isEmpty();
    assertThat(
            captureInfoMessagesForLoggerExecutionPlan(
                Map.of(
                    "loggerExecutionPlanned",
                    true,
                    "allowedLogLevel",
                    "INFO",
                    "allowedMessageSource",
                    "formattedMessagePreview",
                    "formattedMessagePreview",
                    "")))
        .isEmpty();
  }

  @Test
  void onMessageSkipsClassificationBridgeForDuplicateEvenWhenBridgeGateReady() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any()))
        .thenReturn(
            new OrganizationProvisioningCompletedNotificationConsumeResult(
                false,
                true,
                "evt_notification_31",
                "organization-provisioning-completed-notification:31",
                31,
                Map.of(),
                false,
                "already_consumed",
                "duplicate",
                "org001",
                "tenant_org001"));
    when(listenerNoopPlanService.buildPlan(true)).thenReturn(listenerNoopPlan(true));

    listener.onMessage(message);

    verify(listenerNoopPlanService).buildPlan(true);
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
    verify(bridgeReturnThrowDecisionDryRunService, never()).decideDryRun(any(), any());
  }

  @Test
  void onMessageBuildsListenerNoopPlanWithFalseWhenAdapterPlanIsBlocked() {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "blocked"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any()))
        .thenReturn(
            new OrganizationProvisioningCompletedNotificationConsumeResult(
                true,
                false,
                "evt_notification_31",
                "organization-provisioning-completed-notification:31",
                31,
                Map.of(),
                true,
                "notification_send_plan_generated",
                "success",
                "org001",
                "tenant_org001"));

    listener.onMessage(message);

    verify(listenerNoopPlanService).buildPlan(false);
    verify(consumerResultClassificationBridgeService, never()).classifyDryRun(any());
  }

  @Test
  void sourceWiresInAppProviderNoopPlanAndBridgeWithoutValidatorOrManualExecution()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("organizationProvisioningCompletedNotificationConsumerService.consume")
        .contains("NotificationInAppProviderListenerNoopPlanService")
        .contains("NotificationInAppProviderConsumerResultClassificationBridgeService")
        .contains("listenerNoopPlanService.buildPlan(resultAdapterPlanReady(delegationPlan))")
        .contains("consumerResultClassificationBridgeService.classifyDryRun(result)")
        .doesNotContain("NotificationInAppProviderConsumerResultValidationPlanService")
        .doesNotContain("OrganizationProvisioningCompletedInAppProviderManualExecutionService")
        .doesNotContain("consumerResultValidationPlanService")
        .doesNotContain(".execute(");
  }

  @Test
  void sourceKeepsDedicatedConsumerDelegationPipelineOrder() throws IOException {
    String source = notificationRoutingListenerSource();

    assertAppearsInOrder(
        source,
        "private final NotificationRoutingPlanService routingPlanService;",
        "private final NotificationDispatchPreflightService dispatchPreflightService;",
        "private final NotificationHandlerAdapterPlanService adapterPlanService;",
        "private final NotificationAdapterRequestValidationPlanService requestValidationPlanService;",
        "private final NotificationConsumerDelegationPlanService consumerDelegationPlanService;",
        "private final OrganizationProvisioningCompletedNotificationConsumerService",
        "private final NotificationInAppProviderListenerNoopPlanService listenerNoopPlanService;",
        "private final NotificationInAppProviderConsumerResultClassificationBridgeService",
        "private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService",
        "private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService");
    assertAppearsInOrder(
        source,
        "public NotificationRoutingRabbitListener(",
        "NotificationRoutingPlanService routingPlanService",
        "NotificationDispatchPreflightService dispatchPreflightService",
        "NotificationHandlerAdapterPlanService adapterPlanService",
        "NotificationAdapterRequestValidationPlanService requestValidationPlanService",
        "NotificationConsumerDelegationPlanService consumerDelegationPlanService",
        "OrganizationProvisioningCompletedNotificationConsumerService",
        "NotificationInAppProviderListenerNoopPlanService listenerNoopPlanService",
        "NotificationInAppProviderConsumerResultClassificationBridgeService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService");
    assertAppearsInOrder(
        source,
        "routingPlanService.buildPlan(",
        "dispatchPreflightService.buildPlan(routingPlan)",
        "adapterPlanService.buildPlan(routingPlan, dispatchPlan, payload)",
        "requestValidationPlanService.buildPlan(routingPlan, adapterPlan, payload)",
        "consumerDelegationPlanService.buildPlan(routingPlan, requestValidationPlan, payload)",
        "if (Boolean.TRUE.equals(delegationPlan.get(\"delegationAllowed\")))",
        "organizationProvisioningCompletedNotificationConsumerService.consume(",
        "if (ackable(result))",
        "listenerNoopPlanService.buildPlan(resultAdapterPlanReady(delegationPlan))",
        "if (result.consumed() && classificationBridgeReady(listenerNoopPlan))",
        "observationEventConsumeLogRecordSuccessExecutionSwitchPlanService.buildPlan(",
        "observationEventConsumeLogRecordSuccessExecutionAdapterPlanService.buildPlan(",
        "consumerResultClassificationBridgeService.classifyDryRun(result)");
  }

  @Test
  void sourceDoesNotInspectProviderExecutionPlansAfterDedicatedConsumerReturns()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("OrganizationProvisioningCompletedNotificationConsumeResult result")
        .contains("if (ackable(result))")
        .doesNotContain("result.sendPlan()")
        .doesNotContain("result.sendPlanGenerated()")
        .doesNotContain("sendPlan.get")
        .doesNotContain("\"sendPlan\"")
        .doesNotContain("\"providerPlan\"")
        .doesNotContain("\"inAppExecutionPlan\"")
        .doesNotContain("providerReadyChannels")
        .doesNotContain("listenerAutoExecutionGatePlan");
  }

  @Test
  void sourceKeepsRabbitAckNackBoundaryOwnedByContainerOnly() throws IOException {
    String source = notificationRoutingListenerSource();

    assertAppearsInOrder(
        source,
        "if (ackable(result))",
        "return;",
        "throw new IllegalStateException(",
        "\"notification dedicated consumer returned non-ackable result");
    assertThat(source)
        .contains("\"notification consumer delegation blocked, message remains unconfirmed")
        .doesNotContain("com.rabbitmq.client.Channel")
        .doesNotContain("Acknowledgment")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject")
        .doesNotContain("AmqpRejectAndDontRequeueException")
        .doesNotContain("ImmediateAcknowledgeAmqpException")
        .doesNotContain(".acknowledge(");
  }

  @Test
  void sourceKeepsConstructorDependencySurfaceAfterBridgeDryRunIntegration() throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertAppearsInOrder(
        source,
        "public NotificationRoutingRabbitListener(",
        "NotificationRoutingPlanService routingPlanService",
        "NotificationDispatchPreflightService dispatchPreflightService",
        "NotificationHandlerAdapterPlanService adapterPlanService",
        "NotificationAdapterRequestValidationPlanService requestValidationPlanService",
        "NotificationConsumerDelegationPlanService consumerDelegationPlanService",
        "OrganizationProvisioningCompletedNotificationConsumerService",
        "NotificationInAppProviderListenerNoopPlanService listenerNoopPlanService",
        "NotificationInAppProviderConsumerResultClassificationBridgeService",
        "NotificationInAppProviderBridgeReturnThrowDecisionDryRunService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService",
        "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService");
    assertThat(source)
        .contains("this.routingPlanService = routingPlanService;")
        .contains("this.dispatchPreflightService = dispatchPreflightService;")
        .contains("this.adapterPlanService = adapterPlanService;")
        .contains("this.requestValidationPlanService = requestValidationPlanService;")
        .contains("this.consumerDelegationPlanService = consumerDelegationPlanService;")
        .contains(
            "this.organizationProvisioningCompletedNotificationConsumerService =")
        .contains("this.listenerNoopPlanService = listenerNoopPlanService;")
        .contains(
            "this.consumerResultClassificationBridgeService = consumerResultClassificationBridgeService;")
        .contains(
            "this.bridgeReturnThrowDecisionDryRunService = bridgeReturnThrowDecisionDryRunService;")
        .contains("this.observationLogPayloadDryRunService = observationLogPayloadDryRunService;")
        .contains("NotificationInAppProviderListenerNoopPlanService")
        .contains("NotificationInAppProviderConsumerResultClassificationBridgeService")
        .contains("NotificationInAppProviderBridgeReturnThrowDecisionDryRunService")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService")
        .contains("this.observationLogDryRunService = observationLogDryRunService;")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService")
        .contains("this.observationLogMessageDryRunService = observationLogMessageDryRunService;")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService")
        .contains(
            "this.observationLoggerInvocationDryRunService = observationLoggerInvocationDryRunService;")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService")
        .contains(
            "this.observationLoggerExecutionPlanService = observationLoggerExecutionPlanService;")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService")
        .contains(
            "this.observationEventConsumeLogWritePlanService = observationEventConsumeLogWritePlanService;")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService")
        .contains(
            "this.observationEventConsumeLogRepositoryIntegrationPlanService =")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService")
        .contains(
            "this.observationEventConsumeLogRepositoryCallPlanService =")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService")
        .contains(
            "this.observationEventConsumeLogRecordSuccessExecutionGatePlanService =")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService")
        .contains(
            "this.observationEventConsumeLogRecordSuccessExecutionSwitchPlanService =")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService")
        .contains(
            "this.observationEventConsumeLogRecordSuccessExecutionAdapterPlanService =")
        .doesNotContain("NotificationInAppProviderConsumerResultValidationPlanService")
        .doesNotContain("OrganizationProvisioningCompletedInAppProviderManualExecutionService");
  }

  @Test
  void sourceReadsOnlyBridgeGatePlanAndDoesNotReadSendPlanBeforeManualIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertAppearsInOrder(
        source,
        "OrganizationProvisioningCompletedNotificationConsumeResult result",
        "organizationProvisioningCompletedNotificationConsumerService.consume(",
        "if (ackable(result))");
    assertThat(source)
        .contains(
            "private boolean ackable("
                + "OrganizationProvisioningCompletedNotificationConsumeResult result)")
        .contains("classificationBridgeReady(listenerNoopPlan)")
        .contains("classificationBridgeGatePlan")
        .contains("bridgeInvocationAllowed")
        .doesNotContain("validatorInput")
        .doesNotContain("validationInput")
        .doesNotContain("classificationInput")
        .doesNotContain("result.sendPlan()")
        .doesNotContain("result.sendPlanGenerated()")
        .doesNotContain("sendPlan.get")
        .doesNotContain("\"sendPlan\"")
        .doesNotContain("\"providerPlan\"")
        .doesNotContain("\"inAppExecutionPlan\"");
  }

  @Test
  void sourceKeepsBridgeDryRunBoundaryWithoutManualAckNack()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertAppearsInOrder(
        source,
        "routingPlanService.buildPlan(",
        "dispatchPreflightService.buildPlan(routingPlan)",
        "adapterPlanService.buildPlan(routingPlan, dispatchPlan, payload)",
        "requestValidationPlanService.buildPlan(routingPlan, adapterPlan, payload)",
        "consumerDelegationPlanService.buildPlan(routingPlan, requestValidationPlan, payload)",
        "if (Boolean.TRUE.equals(delegationPlan.get(\"delegationAllowed\")))",
        "organizationProvisioningCompletedNotificationConsumerService.consume(",
        "if (ackable(result))",
        "listenerNoopPlanService.buildPlan(resultAdapterPlanReady(delegationPlan))",
        "if (result.consumed() && classificationBridgeReady(listenerNoopPlan))",
        "if (bridgeDecisionDryRunInvocationReady(listenerNoopPlan))",
        "bridgeReturnThrowDecisionDryRunService.decideDryRun(",
        "observationLogPayloadDryRunService.buildDryRun(",
        "observationLogDryRunService.buildDryRun(",
        "consumerResultClassificationBridgeService.classifyDryRun(result)",
        "return;",
        "throw new IllegalStateException(",
        "\"notification dedicated consumer returned non-ackable result");
    assertThat(countOccurrences(source, "return;")).isEqualTo(1);
    assertThat(countOccurrences(source, "throw new IllegalStateException(")).isEqualTo(2);
    assertThat(source)
        .contains("NotificationInAppProviderListenerNoopPlanService")
        .contains("NotificationInAppProviderConsumerResultClassificationBridgeService")
        .doesNotContain("NotificationInAppProviderConsumerResultValidationPlanService")
        .doesNotContain("OrganizationProvisioningCompletedInAppProviderManualExecutionService")
        .doesNotContain("manualExecution")
        .doesNotContain(".execute(")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceKeepsNoopPlanGenerationInsideAckableBranchOnly() throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "listenerNoopPlanService.buildPlan(")).isEqualTo(1);
    assertAppearsInOrder(
        source,
        "if (Boolean.TRUE.equals(delegationPlan.get(\"delegationAllowed\")))",
        "organizationProvisioningCompletedNotificationConsumerService.consume(",
        "if (ackable(result))",
        "listenerNoopPlanService.buildPlan(resultAdapterPlanReady(delegationPlan))",
        "if (result.consumed() && classificationBridgeReady(listenerNoopPlan))",
        "consumerResultClassificationBridgeService.classifyDryRun(result)",
        "return;",
        "throw new IllegalStateException(",
        "\"notification dedicated consumer returned non-ackable result",
        "throw new IllegalStateException(",
        "\"notification consumer delegation blocked, message remains unconfirmed");
    assertThat(source)
        .doesNotContain("listenerNoopPlanService.buildPlan(result)")
        .doesNotContain("listenerNoopPlanService.buildPlan(consumerResult)")
        .doesNotContain("listenerNoopPlanService.buildPlan(dedicatedConsumerResult)")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceDocumentsListenerNoopSafetyMatrixAfterDryRunIntegration() throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(listenerNoopSafetyMatrix())
        .satisfiesExactly(
            row ->
                assertThat(row)
                    .containsEntry("path", "delegation_blocked")
                    .containsEntry("dedicatedConsumerInvoked", false)
                    .containsEntry("noopPlanInvoked", false)
                    .containsEntry("listenerOutcome", "throw_delegation_blocked"),
            row ->
                assertThat(row)
                    .containsEntry("path", "dedicated_consumer_non_ackable")
                    .containsEntry("dedicatedConsumerInvoked", true)
                    .containsEntry("noopPlanInvoked", false)
                    .containsEntry("listenerOutcome", "throw_non_ackable_result"),
            row ->
                assertThat(row)
                    .containsEntry("path", "ackable_missing_adapter_plan")
                    .containsEntry("noopPlanInvoked", true)
                    .containsEntry("noopAdapterPlanReady", false)
                    .containsEntry("listenerOutcome", "return_to_container_policy"),
            row ->
                assertThat(row)
                    .containsEntry("path", "ackable_blocked_adapter_plan")
                    .containsEntry("noopPlanInvoked", true)
                    .containsEntry("noopAdapterPlanReady", false)
                    .containsEntry("listenerOutcome", "return_to_container_policy"),
            row ->
                assertThat(row)
                    .containsEntry("path", "ackable_ready_adapter_plan")
                    .containsEntry("noopPlanInvoked", true)
                    .containsEntry("noopAdapterPlanReady", true)
                    .containsEntry("listenerOutcome", "return_to_container_policy"));
    assertThat(listenerNoopSafetyMatrix())
        .allSatisfy(
            row ->
                assertThat(row)
                    .containsEntry("validatorInvoked", false)
                    .containsEntry("manualExecutionInvoked", false)
                    .containsEntry("rabbitAckExecuted", false)
                    .containsEntry("rabbitNackExecuted", false)
                    .containsEntry("websocketExecuted", false)
                    .containsEntry("pushExecuted", false));
    assertThat(source)
        .contains("listenerNoopPlanService.buildPlan(resultAdapterPlanReady(delegationPlan))")
        .doesNotContain(".classify(")
        .doesNotContain("OrganizationProvisioningCompletedInAppProviderManualExecutionService")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceKeepsValidatorInvocationBlockedAfterNoopDryRunIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("listenerNoopPlanService.buildPlan(resultAdapterPlanReady(delegationPlan))")
        .contains("inputAdapterPlan")
        .contains("validatorContractPlan")
        .contains("validatorInvocationGatePlan")
        .contains("classificationBridgeGatePlan")
        .doesNotContain("consumerResultValidation")
        .contains("classifyDryRun(result)")
        .doesNotContain("result.sendPlan()")
        .doesNotContain("result.sendPlanGenerated()")
        .doesNotContain("sendPlan.get")
        .doesNotContain("\"sendPlan\"")
        .doesNotContain("\"providerPlan\"")
        .doesNotContain("\"inAppExecutionPlan\"")
        .doesNotContain("OrganizationProvisioningCompletedInAppProviderManualExecutionService")
        .doesNotContain(".execute(");
  }

  @Test
  void sourceKeepsValidatorGatePlanOutOfListenerBeforeRealValidationIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("NotificationInAppProviderListenerNoopPlanService")
        .contains("listenerNoopPlanService.buildPlan(resultAdapterPlanReady(delegationPlan))")
        .contains("validatorInvocationGatePlan")
        .contains("classificationBridgeGatePlan")
        .doesNotContain("NotificationInAppProviderConsumerResultValidationPlanService")
        .doesNotContain("organizationProvisioningInAppProviderResultAdapterValidatorEnabled")
        .doesNotContain("isOrganizationProvisioningInAppProviderResultAdapterValidatorEnabled")
        .contains("inputAdapterPlan")
        .contains("classifyDryRun(result)")
        .doesNotContain("consumerResultForwardedToValidator")
        .doesNotContain("classificationExecuted");
  }

  @Test
  void sourceWiresClassificationBridgeDryRunWithoutManualAckNack()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("listenerNoopPlanService.buildPlan(resultAdapterPlanReady(delegationPlan))")
        .contains("NotificationInAppProviderConsumerResultClassificationBridgeService")
        .contains("classificationBridgeGatePlan")
        .contains("classifyDryRun(result)")
        .contains("consumerResultClassificationBridge")
        .contains("result.consumed() && classificationBridgeReady(listenerNoopPlan)")
        .doesNotContain("result.sendPlan()")
        .doesNotContain("result.sendPlanGenerated()")
        .doesNotContain("result.providerPlan")
        .doesNotContain("sendPlan.get")
        .doesNotContain("\"providerPlan\"")
        .doesNotContain("\"inAppExecutionPlan\"")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceDoesNotReadBridgeReturnThrowPolicyGateBeforePolicySwitchIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertAppearsInOrder(
        source,
        "if (result.consumed() && classificationBridgeReady(listenerNoopPlan))",
        "consumerResultClassificationBridgeService.classifyDryRun(result)",
        "return;",
        "throw new IllegalStateException(",
        "\"notification dedicated consumer returned non-ackable result");
    assertThat(source)
        .contains("classificationBridgeReady(listenerNoopPlan)")
        .contains("classificationBridgeGatePlan")
        .contains("bridgeInvocationAllowed")
        .contains("bridgeReturnThrowPolicyGatePlan(listenerNoopPlan)")
        .contains("classifyDryRun(result)")
        .doesNotContain("returnThrowPolicyGateEnabled")
        .doesNotContain("returnThrowPolicyChangeAllowed")
        .doesNotContain("futureReturnThrowDecision")
        .doesNotContain("bridgeResultObservationPlan")
        .doesNotContain("logMessageKey")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceKeepsReturnThrowPolicyDecisionServiceOutOfListenerBeforeIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains("NotificationInAppProviderConsumerResultClassificationBridgeService")
        .contains("consumerResultClassificationBridgeService.classifyDryRun(result)")
        .contains("bridgeReturnThrowDecisionDryRunService.decideDryRun(")
        .doesNotContain("NotificationInAppProviderBridgeReturnThrowPolicyDecisionService")
        .doesNotContain("bridgeReturnThrowPolicyDecisionService")
        .doesNotContain("futureListenerDecision")
        .doesNotContain("decisionApplied")
        .doesNotContain("throwRequested")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceWiresReturnThrowDecisionDryRunCompositionBehindInvocationGate()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains("NotificationInAppProviderConsumerResultClassificationBridgeService")
        .contains("NotificationInAppProviderBridgeReturnThrowDecisionDryRunService")
        .contains("bridgeDecisionDryRunInvocationReady(listenerNoopPlan)")
        .contains("bridgeDecisionDryRunInvocationGatePlan")
        .contains("decisionDryRunInvocationAllowed")
        .contains("bridgeReturnThrowDecisionDryRunService.decideDryRun(")
        .contains("observationLogPayloadDryRunService.buildDryRun(")
        .contains("bridgeReturnThrowPolicyGatePlan(listenerNoopPlan)")
        .contains("consumerResultClassificationBridgeService.classifyDryRun(result)")
        .doesNotContain("policyDecisionPlan")
        .doesNotContain("bridgeDryRunExecuted")
        .doesNotContain("policyDecisionDryRunExecuted")
        .doesNotContain("ready_for_listener_return_throw_decision_dry_run")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceReadsBridgeDecisionDryRunInvocationGateOnlyForReadOnlyComposition()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains("classificationBridgeGatePlan")
        .contains("bridgeInvocationAllowed")
        .contains("bridgeDecisionDryRunInvocationGatePlan")
        .contains("decisionDryRunInvocationAllowed")
        .contains("NotificationInAppProviderBridgeReturnThrowDecisionDryRunService")
        .contains("bridgeReturnThrowDecisionDryRunService")
        .contains("decideDryRun(")
        .contains("observationLogPayloadDryRunService.buildDryRun(")
        .contains("consumerResultClassificationBridgeService.classifyDryRun(result)")
        .doesNotContain("policyDecisionPlan")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceDoesNotReadDecisionOutputObservationPlanBeforeLoggingIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("bridgeReturnThrowDecisionDryRunService.decideDryRun(")
        .contains("bridgeReturnThrowPolicyGatePlan(listenerNoopPlan)")
        .doesNotContain("decisionOutputObservationPlan")
        .doesNotContain("logMessageKey")
        .doesNotContain("observationExecuted")
        .doesNotContain("logExecuted")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceReadsDecisionOutputObservationLoggingGateOnlyForDryRunGatesWithoutLogging()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("bridgeReturnThrowDecisionDryRunService.decideDryRun(")
        .contains("bridgeDecisionDryRunInvocationReady(listenerNoopPlan)")
        .contains("decisionOutputObservationLoggingGatePlan(listenerNoopPlan)")
        .contains("\"decisionOutputObservationLoggingGatePlan\"")
        .contains("observationLogPayloadDryRunService.buildDryRun(")
        .contains("loggerInvocationGatePlan(loggingGatePlan)")
        .contains("observationLoggingAllowed")
        .doesNotContain("observationLoggingExecuted")
        .doesNotContain("notification.in_app_provider.bridge_return_throw_decision_dry_run")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceDoesNotReadObservationLoggingPayloadPlanBeforeIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("bridgeReturnThrowDecisionDryRunService.decideDryRun(")
        .contains("bridgeReturnThrowPolicyGatePlan(listenerNoopPlan)")
        .doesNotContain("observationLoggingPayloadPlan")
        .doesNotContain("payloadFields")
        .doesNotContain("payloadBuildRequested")
        .doesNotContain("payloadBuildExecuted")
        .doesNotContain("payloadWritten")
        .doesNotContain("logMessageKey")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceWiresObservationLogPayloadDryRunServiceWithoutLogging()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService")
        .contains("observationLogPayloadDryRunService")
        .contains("buildDryRun(")
        .doesNotContain("payloadPreview")
        .doesNotContain("payloadBuildExecuted")
        .doesNotContain("payloadWritten")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceWiresObservationLogDryRunServiceWithoutRealLogging()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationLogPayloadDryRunService.buildDryRun(")
        .contains("observationLogDryRunService.buildDryRun(")
        .contains("payloadDryRunPlan")
        .contains("decisionOutputObservationLoggingGatePlan(listenerNoopPlan)")
        .doesNotContain(".warn(")
        .doesNotContain("payloadPreview")
        .doesNotContain("payloadBuildExecuted")
        .doesNotContain("logMessageKey")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceWiresObservationLogDryRunServiceWithoutReadingItsOutput()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService")
        .contains("observationLogPayloadDryRunService.buildDryRun(")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService")
        .contains("observationLogDryRunService.buildDryRun(")
        .doesNotContain("logPayloadPreview")
        .doesNotContain("observationLoggingExecuted")
        .doesNotContain("logPlanned")
        .doesNotContain("logExecuted")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceKeepsDatabaseWritesOutBeforeObservationLoggingExecutionIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationLogPayloadDryRunService.buildDryRun(")
        .contains("observationLogDryRunService.buildDryRun(")
        .doesNotContain(".warn(")
        .doesNotContain(".error(")
        .doesNotContain("in_app_notification")
        .doesNotContain("databaseWrite")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceWiresObservationLogMessageDryRunServiceBeforeGatedLoggerHelper()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains("observationLogDryRunService.buildDryRun(")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService")
        .contains("observationLogMessageDryRunService.buildDryRun(")
        .contains("invokeLoggerIfPlanned(loggerExecutionPlan)")
        .doesNotContain("messageFormattingPreviewGenerated")
        .doesNotContain("loggerInvocationExecuted")
        .doesNotContain("databaseWrite")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceKeepsDatabaseWritesOutAfterObservationLogMessageDryRunIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationLogMessageDryRunService.buildDryRun(")
        .contains("invokeLoggerIfPlanned(loggerExecutionPlan)")
        .doesNotContain("loggerInvocationExecuted")
        .doesNotContain(".warn(")
        .doesNotContain(".error(")
        .doesNotContain("in_app_notification")
        .doesNotContain("databaseWrite")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceWiresObservationLoggerInvocationDryRunServiceWithoutReadingItsOutput()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains("observationLogMessageDryRunService.buildDryRun(")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService")
        .contains("observationLoggerInvocationDryRunService.buildDryRun(")
        .contains("loggerInvocationGatePlan(loggingGatePlan)")
        .doesNotContain("loggerInvocationPlanned")
        .doesNotContain("loggerNamePreview")
        .doesNotContain("logLevelPreview")
        .doesNotContain("databaseWrite")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceKeepsDatabaseWritesOutAfterLoggerInvocationDryRunIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationLoggerInvocationDryRunService.buildDryRun(")
        .contains("loggerInvocationGatePlan(loggingGatePlan)")
        .doesNotContain("loggerInvocationPlanned")
        .doesNotContain("loggerInvocationExecuted")
        .doesNotContain(".warn(")
        .doesNotContain(".error(")
        .doesNotContain("in_app_notification")
        .doesNotContain("databaseWrite")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceWiresLoggerExecutionPlanServiceWithGatedInfoLogging()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains("observationLoggerInvocationDryRunService.buildDryRun(")
        .contains("loggerInvocationGatePlan(loggingGatePlan)")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService")
        .contains("observationLoggerExecutionPlanService.buildPlan(")
        .contains("loggerExecutionGatePlan(loggingGatePlan)")
        .contains("invokeLoggerIfPlanned(loggerExecutionPlan)")
        .contains("loggerExecutionPlanned")
        .contains("allowedLogLevel")
        .contains("allowedMessageSource")
        .contains("LOGGER.info(formattedMessagePreview)")
        .doesNotContain("loggerInvocationExecuted")
        .doesNotContain("loggerNamePreview")
        .doesNotContain(".warn(")
        .doesNotContain(".error(")
        .doesNotContain("in_app_notification")
        .doesNotContain("databaseWrite")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceKeepsLoggerExecutionLimitedToGatedInfoWithoutDatabaseWrites()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationLoggerExecutionPlanService.buildPlan(")
        .contains("loggerExecutionGatePlan(loggingGatePlan)")
        .contains("private static final Logger LOGGER")
        .contains("LoggerFactory.getLogger(NotificationRoutingRabbitListener.class)")
        .contains("invokeLoggerIfPlanned(loggerExecutionPlan)")
        .contains("loggerExecutionPlanned")
        .contains("\"INFO\".equals(stringValue(plan.get(\"allowedLogLevel\")))")
        .contains("\"formattedMessagePreview\".equals(stringValue(plan.get(\"allowedMessageSource\")))")
        .contains("LOGGER.info(formattedMessagePreview)")
        .doesNotContain("loggerInvocationExecuted")
        .doesNotContain(".warn(")
        .doesNotContain(".error(")
        .doesNotContain("in_app_notification")
        .doesNotContain("databaseWrite")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceWiresEventConsumeLogWritePlanServiceWithoutExecutingSql()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains("invokeLoggerIfPlanned(loggerExecutionPlan)")
        .contains("LOGGER.info(formattedMessagePreview)")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService")
        .contains("observationEventConsumeLogWritePlanService.buildPlan(")
        .contains("eventConsumeLogWriteGatePlan(loggingGatePlan)")
        .contains("eventConsumeLogWriteAllowed")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("sqlExecuted")
        .doesNotContain("JdbcTemplate")
        .doesNotContain("EventConsumeLogRepository eventConsumeLogRepository")
        .doesNotContain("Mapper")
        .doesNotContain(".insert")
        .doesNotContain(".save(")
        .doesNotContain(".update(")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourcePassesEventConsumeLogWritePlanOnlyIntoRepositoryIntegrationDryRun()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationEventConsumeLogWritePlanService.buildPlan(")
        .contains("loggerExecutionPlan")
        .contains("eventConsumeLogWriteGatePlan(loggingGatePlan)")
        .contains("observationEventConsumeLogRepositoryIntegrationPlanService.buildPlan(")
        .contains("eventConsumeLogRepositoryMetadataPlan(properties)")
        .doesNotContain("eventConsumeLogWritePlan =")
        .doesNotContain("eventConsumeLogWritePlan.get")
        .doesNotContain("databaseWritePlanned")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("sqlExecuted")
        .doesNotContain("rabbitNackExecuted")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceKeepsRealEventConsumeLogRepositoryOutBeforeSqlIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationEventConsumeLogWritePlanService.buildPlan(")
        .contains("observationEventConsumeLogRepositoryIntegrationPlanService.buildPlan(")
        .doesNotContain("EventConsumeLogRepository eventConsumeLogRepository")
        .doesNotContain("eventConsumeLogRepository.")
        .doesNotContain("EventConsumeLogMapper")
        .doesNotContain("JdbcTemplate")
        .doesNotContain("@Transactional")
        .doesNotContain("writeMode")
        .doesNotContain(".recordSuccess(")
        .doesNotContain(".claimProcessing(")
        .doesNotContain(".markSuccess(")
        .doesNotContain(".markFailure(")
        .doesNotContain(".insert")
        .doesNotContain(".save(")
        .doesNotContain(".update(")
        .doesNotContain("execute(");
  }

  @Test
  void sourceWiresRepositoryIntegrationPlanServiceWithoutExecutingSql()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains("observationEventConsumeLogWritePlanService.buildPlan(")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService")
        .contains("observationEventConsumeLogRepositoryIntegrationPlanService.buildPlan(")
        .contains("eventConsumeLogRepositoryMetadataPlan(properties)")
        .contains("notification-in-app-provider-observation")
        .contains("RabbitMqTopology.QUEUE_NOTIFICATION")
        .doesNotContain("repositoryIntegrationPlanned")
        .doesNotContain("eventConsumeLogEntryPreview")
        .doesNotContain("repositoryClassPreview")
        .doesNotContain("repositoryMethodPreview")
        .doesNotContain("repositoryInvoked")
        .doesNotContain("EventConsumeLogRepository eventConsumeLogRepository")
        .doesNotContain("eventConsumeLogRepository.")
        .doesNotContain("JdbcTemplate")
        .doesNotContain(".recordSuccess(")
        .doesNotContain(".claimProcessing(")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceIgnoresRepositoryIntegrationPlanOutputAfterReadOnlyIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationEventConsumeLogRepositoryIntegrationPlanService.buildPlan(")
        .contains("eventConsumeLogRepositoryMetadataPlan(properties)")
        .doesNotContain("repositoryIntegrationPlan =")
        .doesNotContain("repositoryIntegrationPlan.get")
        .doesNotContain("repositoryIntegrationPlanned")
        .doesNotContain("eventConsumeLogEntryPreview")
        .doesNotContain("repositoryInvoked")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("sqlExecuted")
        .doesNotContain("rabbitNackExecuted")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceKeepsRealEventConsumeLogRepositoryCallOutBeforeExecutionIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationEventConsumeLogRepositoryIntegrationPlanService.buildPlan(")
        .doesNotContain("private final EventConsumeLogRepository")
        .doesNotContain("EventConsumeLogRepository eventConsumeLogRepository")
        .doesNotContain("this.eventConsumeLogRepository")
        .doesNotContain("@Transactional")
        .doesNotContain(".recordSuccess(")
        .doesNotContain(".recordFailure(")
        .doesNotContain(".claimProcessing(")
        .doesNotContain(".markSuccess(")
        .doesNotContain(".markFailure(")
        .doesNotContain("JdbcTemplate")
        .doesNotContain(".update(")
        .doesNotContain("execute(")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceWiresRepositoryCallPlanServiceWithoutExecutingRepository()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains("observationEventConsumeLogRepositoryIntegrationPlanService.buildPlan(")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService")
        .contains("observationEventConsumeLogRepositoryCallPlanService.buildPlan(")
        .doesNotContain("repositoryCallPlan =")
        .doesNotContain("repositoryCallPlan.get")
        .doesNotContain("repositoryCallPlanned")
        .doesNotContain("repositoryArgumentPreview")
        .doesNotContain("insertedResultObserved")
        .doesNotContain("repositoryInvoked")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("sqlExecuted")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceIgnoresRepositoryCallPlanOutputAfterReadOnlyIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationEventConsumeLogRepositoryCallPlanService.buildPlan(")
        .doesNotContain("repositoryCallPlan =")
        .doesNotContain("repositoryCallPlan.get")
        .doesNotContain("repositoryCallPlanned")
        .doesNotContain("repositoryArgumentPreview")
        .doesNotContain("repositoryInvocationOrderPreview")
        .doesNotContain("insertedResultObserved")
        .doesNotContain("repositoryInvoked")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("sqlExecuted")
        .doesNotContain("rabbitNackExecuted")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceKeepsRecordSuccessExecutionOutAfterRepositoryCallPlanReadOnlyIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationEventConsumeLogRepositoryCallPlanService.buildPlan(")
        .doesNotContain("private final EventConsumeLogRepository")
        .doesNotContain("EventConsumeLogRepository eventConsumeLogRepository")
        .doesNotContain("this.eventConsumeLogRepository")
        .doesNotContain("EventConsumeLogEntry")
        .doesNotContain("recordSuccess(")
        .doesNotContain(".recordSuccess(")
        .doesNotContain("boolean inserted")
        .doesNotContain("insertedResult")
        .doesNotContain("JdbcTemplate")
        .doesNotContain("@Transactional")
        .doesNotContain(".update(")
        .doesNotContain("execute(")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceWiresRecordSuccessExecutionGatePlanServiceWithoutExecutingRepository()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains("observationEventConsumeLogRepositoryCallPlanService.buildPlan(")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService")
        .contains("observationEventConsumeLogRecordSuccessExecutionGatePlanService.buildPlan(")
        .contains("recordSuccessExecutionGatePlan()")
        .contains("\"recordSuccessExecutionAllowed\", false")
        .doesNotContain("recordSuccessExecutionGatePlan =")
        .doesNotContain("recordSuccessExecutionGatePlan.get")
        .doesNotContain("recordSuccessExecutionPlanned")
        .doesNotContain("repositoryInvoked")
        .doesNotContain("insertedResultObserved")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("sqlExecuted")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceIgnoresRecordSuccessExecutionGatePlanOutputAfterReadOnlyIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationEventConsumeLogRecordSuccessExecutionGatePlanService.buildPlan(")
        .doesNotContain("recordSuccessExecutionGatePlan =")
        .doesNotContain("recordSuccessExecutionGatePlan.get")
        .doesNotContain("recordSuccessExecutionPlanned")
        .doesNotContain("repositoryInvoked")
        .doesNotContain("insertedResultObserved")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("sqlExecuted")
        .doesNotContain("listenerPolicyChanged")
        .doesNotContain("decisionApplied")
        .doesNotContain("throwRequested")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceKeepsRecordSuccessRepositoryExecutionOutAfterExecutionGatePlanIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationEventConsumeLogRecordSuccessExecutionGatePlanService.buildPlan(")
        .contains("recordSuccessExecutionGatePlan()")
        .contains("\"recordSuccessExecutionAllowed\", false")
        .doesNotContain("private final EventConsumeLogRepository")
        .doesNotContain("EventConsumeLogRepository eventConsumeLogRepository")
        .doesNotContain("this.eventConsumeLogRepository")
        .doesNotContain("EventConsumeLogEntry")
        .doesNotContain("new EventConsumeLogEntry")
        .doesNotContain("recordSuccess(")
        .doesNotContain(".recordSuccess(")
        .doesNotContain("boolean inserted")
        .doesNotContain("insertedResult")
        .doesNotContain("JdbcTemplate")
        .doesNotContain("@Transactional")
        .doesNotContain(".update(")
        .doesNotContain("execute(")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceWiresRecordSuccessExecutionSwitchPlanServiceWithoutExecutingRepository()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains("observationEventConsumeLogRecordSuccessExecutionGatePlanService.buildPlan(")
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService")
        .contains("observationEventConsumeLogRecordSuccessExecutionSwitchPlanService.buildPlan(")
        .contains("recordSuccessExecutionSwitchPlan()")
        .contains("\"recordSuccessExecutionSwitchProperty\"")
        .contains("\"RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED\"")
        .contains("\"recordSuccessExecutionSwitchAllowed\"")
        .contains("false")
        .doesNotContain("recordSuccessExecutionSwitchPlan =")
        .doesNotContain("recordSuccessExecutionSwitchPlan.get")
        .doesNotContain("recordSuccessExecutionAdapterPlanned")
        .doesNotContain("System.getenv")
        .doesNotContain("@Value")
        .doesNotContain("Environment")
        .doesNotContain("recordSuccess(")
        .doesNotContain(".recordSuccess(")
        .doesNotContain("JdbcTemplate")
        .doesNotContain("@Transactional")
        .doesNotContain(".update(")
        .doesNotContain("execute(")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceIgnoresRecordSuccessExecutionSwitchPlanOutputAfterReadOnlyIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationEventConsumeLogRecordSuccessExecutionSwitchPlanService.buildPlan(")
        .doesNotContain("recordSuccessExecutionSwitchPlan =")
        .doesNotContain("recordSuccessExecutionSwitchPlan.get")
        .doesNotContain("recordSuccessExecutionAdapterPlanned")
        .doesNotContain("repositoryInvoked")
        .doesNotContain("insertedResultObserved")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("sqlExecuted")
        .doesNotContain("listenerPolicyChanged")
        .doesNotContain("decisionApplied")
        .doesNotContain("throwRequested")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceKeepsRecordSuccessAdapterExecutionOutAfterSwitchPlanReadOnlyIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationEventConsumeLogRecordSuccessExecutionSwitchPlanService.buildPlan(")
        .contains("recordSuccessExecutionSwitchPlan()")
        .contains("\"recordSuccessExecutionSwitchAllowed\"")
        .contains("false")
        .contains("observationEventConsumeLogRecordSuccessExecutionAdapterPlanService.buildPlan(")
        .contains("recordSuccessExecutionAdapterPlan()")
        .contains("\"recordSuccessExecutionAdapterProperty\"")
        .contains(
            "\"RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ADAPTER_ENABLED\"")
        .contains("\"recordSuccessExecutionAdapterAllowed\"")
        .contains("false")
        .doesNotContain("private final EventConsumeLogRepository")
        .doesNotContain("EventConsumeLogRepository eventConsumeLogRepository")
        .doesNotContain("this.eventConsumeLogRepository")
        .doesNotContain("EventConsumeLogEntry")
        .doesNotContain("new EventConsumeLogEntry")
        .doesNotContain("recordSuccess(")
        .doesNotContain(".recordSuccess(")
        .doesNotContain("boolean inserted")
        .doesNotContain("insertedResult")
        .doesNotContain("JdbcTemplate")
        .doesNotContain("@Transactional")
        .doesNotContain(".update(")
        .doesNotContain("execute(")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceIgnoresRecordSuccessExecutionAdapterPlanOutputAfterReadOnlyIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(source)
        .contains("observationEventConsumeLogRecordSuccessExecutionAdapterPlanService.buildPlan(")
        .doesNotContain("recordSuccessExecutionAdapterPlan =")
        .doesNotContain("recordSuccessExecutionAdapterPlan.get")
        .doesNotContain("recordSuccessExecutionAdapterPlanned")
        .doesNotContain("repositoryInvoked")
        .doesNotContain("insertedResultObserved")
        .doesNotContain("databaseWriteExecuted")
        .doesNotContain("sqlExecuted")
        .doesNotContain("rabbitNackExecuted")
        .doesNotContain("listenerPolicyChanged")
        .doesNotContain("decisionApplied")
        .doesNotContain("throwRequested")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceWiresRecordSuccessExecutionAdapterPlanServiceWithoutExecutingRepository()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(countOccurrences(source, "private final ")).isEqualTo(20);
    assertThat(source)
        .contains(
            "NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService")
        .contains("observationEventConsumeLogRecordSuccessExecutionAdapterPlanService.buildPlan(")
        .contains("recordSuccessExecutionAdapterPlan()")
        .contains("\"recordSuccessExecutionAdapterProperty\"")
        .contains(
            "\"RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ADAPTER_ENABLED\"")
        .contains("\"recordSuccessExecutionAdapterAllowed\"")
        .contains("false")
        .doesNotContain("recordSuccessExecutionAdapterPlan =")
        .doesNotContain("recordSuccessExecutionAdapterPlan.get")
        .doesNotContain("System.getenv")
        .doesNotContain("@Value")
        .doesNotContain("Environment")
        .doesNotContain("recordSuccess(")
        .doesNotContain(".recordSuccess(")
        .doesNotContain("JdbcTemplate")
        .doesNotContain("@Transactional")
        .doesNotContain(".update(")
        .doesNotContain("execute(")
        .doesNotContain("basicAck")
        .doesNotContain("basicNack")
        .doesNotContain("basicReject");
  }

  @Test
  void sourceDocumentsFutureBridgeInvocationPolicyBeforeListenerIntegration()
      throws IOException {
    String source = notificationRoutingListenerSource();

    assertThat(futureBridgeInvocationPolicyMatrix())
        .satisfiesExactly(
            row ->
                assertThat(row)
                    .containsEntry("path", "duplicate_without_send_plan")
                    .containsEntry("bridgeInvocationExpected", false)
                    .containsEntry("listenerOutcome", "return_to_container_policy"),
            row ->
                assertThat(row)
                    .containsEntry("path", "consumed_adapter_blocked")
                    .containsEntry("bridgeInvocationExpected", true)
                    .containsEntry(
                        "futureReturnThrowDecision",
                        "throw_before_classify_until_real_adapter_policy_batch"),
            row ->
                assertThat(row)
                    .containsEntry("path", "consumed_validation_blocked")
                    .containsEntry("bridgeInvocationExpected", true)
                    .containsEntry(
                        "futureReturnThrowDecision",
                        "throw_for_retry_or_dlq_until_real_policy_batch"),
            row ->
                assertThat(row)
                    .containsEntry("path", "consumed_validation_ready")
                    .containsEntry("bridgeInvocationExpected", true)
                    .containsEntry(
                        "futureReturnThrowDecision",
                        "return_deferred_until_manual_execution_result_is_verified"));
    assertThat(futureBridgeInvocationPolicyMatrix())
        .allSatisfy(
            row ->
                assertThat(row)
                    .containsEntry("manualExecutionInvoked", false)
                    .containsEntry("rabbitAckExecuted", false)
                    .containsEntry("rabbitNackExecuted", false));
    assertThat(source)
        .contains("return result.consumed() || result.duplicate();")
        .contains("NotificationInAppProviderConsumerResultClassificationBridgeService")
        .contains("result.consumed() && classificationBridgeReady(listenerNoopPlan)")
        .contains("classifyDryRun(result)")
        .doesNotContain("result.sendPlan()");
  }

  private List<String> captureInfoMessagesForLoggerExecutionPlan(
      Map<String, Object> loggerExecutionPlan) {
    ch.qos.logback.classic.Logger logger =
        (ch.qos.logback.classic.Logger)
            org.slf4j.LoggerFactory.getLogger(NotificationRoutingRabbitListener.class);
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    try {
      invokeListenerWithLoggerExecutionPlan(loggerExecutionPlan);
      return appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  private void invokeListenerWithLoggerExecutionPlan(Map<String, Object> loggerExecutionPlan) {
    String payload = "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}";
    Message message =
        message(
            payload,
            "msg_notification_31",
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE,
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    Map<String, Object> routingPlan =
        Map.of("route", NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED);
    Map<String, Object> dispatchPlan = Map.of("dispatchAllowed", true);
    Map<String, Object> adapterPlan = Map.of("adapterInvocationAllowed", true);
    Map<String, Object> requestValidationPlan = Map.of("requestValidationPassed", true);
    Map<String, Object> delegationPlan =
        Map.of(
            "route",
            NotificationRoutingPlanService.ROUTE_ORGANIZATION_PROVISIONING_COMPLETED,
            "delegationAllowed",
            true,
            "delegationReadinessFailedChecks",
            List.of(),
            "inAppProviderAutoExecutionAdapterPlan",
            Map.of("planStatus", "ready_for_result_adapter_dry_run"),
            "nextAction",
            "delegate_to_dedicated_consumer_and_ack_success_or_duplicate");
    OrganizationProvisioningCompletedNotificationConsumeResult result =
        new OrganizationProvisioningCompletedNotificationConsumeResult(
            true,
            false,
            "evt_notification_31",
            "organization-provisioning-completed-notification:31",
            31,
            Map.of("providerPlan", Map.of()),
            true,
            "notification_send_plan_generated",
            "success",
            "org001",
            "tenant_org001");
    Map<String, Object> decisionDryRunPlan =
        Map.of(
            "planStatus",
            "ready_for_listener_return_throw_decision_dry_run",
            "decisionOutputObservationPlan",
            Map.of("logMessageKey", "notification.in_app_provider.bridge_return_throw_decision_dry_run"));
    Map<String, Object> payloadDryRunPlan =
        Map.of(
            "payloadBuildExecuted",
            true,
            "payloadPreview",
            Map.of("eventId", "evt_notification_31"));
    Map<String, Object> observationLogDryRunPlan =
        Map.of(
            "logPlanned",
            true,
            "logPayloadPreview",
            Map.of("eventId", "evt_notification_31"),
            "logMessageKey",
            "notification.in_app_provider.bridge_return_throw_decision_dry_run");
    Map<String, Object> messageDryRunPlan =
        Map.of(
            "formattedMessagePreview",
            "would log",
            "messageFormattingPreviewGenerated",
            true);
    Map<String, Object> loggerInvocationDryRunPlan =
        Map.of(
            "loggerInvocationPlanned",
            true,
            "formattedMessagePreview",
            "would log");

    mockPlanPipeline(
        payload, routingPlan, dispatchPlan, adapterPlan, requestValidationPlan, delegationPlan);
    when(organizationNotificationConsumerService.consume(any())).thenReturn(result);
    when(listenerNoopPlanService.buildPlan(true))
        .thenReturn(listenerNoopPlanWithDecisionDryRunGate(true, true, true, true));
    when(bridgeReturnThrowDecisionDryRunService.decideDryRun(eq(result), any()))
        .thenReturn(decisionDryRunPlan);
    when(observationLogPayloadDryRunService.buildDryRun(eq(result), eq(decisionDryRunPlan), any()))
        .thenReturn(payloadDryRunPlan);
    when(observationLogDryRunService.buildDryRun(eq(payloadDryRunPlan), any()))
        .thenReturn(observationLogDryRunPlan);
    when(observationLogMessageDryRunService.buildDryRun(eq(observationLogDryRunPlan)))
        .thenReturn(messageDryRunPlan);
    when(observationLoggerInvocationDryRunService.buildDryRun(eq(messageDryRunPlan), any()))
        .thenReturn(loggerInvocationDryRunPlan);
    when(observationLoggerExecutionPlanService.buildPlan(eq(loggerInvocationDryRunPlan), any()))
        .thenReturn(loggerExecutionPlan);

    listener.onMessage(message);
  }

  private void mockPlanPipeline(
      String payload,
      Map<String, Object> routingPlan,
      Map<String, Object> dispatchPlan,
      Map<String, Object> adapterPlan,
      Map<String, Object> requestValidationPlan,
      Map<String, Object> delegationPlan) {
    when(routingPlanService.buildPlan(any(), any(), eq(payload))).thenReturn(routingPlan);
    when(dispatchPreflightService.buildPlan(routingPlan)).thenReturn(dispatchPlan);
    when(adapterPlanService.buildPlan(routingPlan, dispatchPlan, payload)).thenReturn(adapterPlan);
    when(requestValidationPlanService.buildPlan(routingPlan, adapterPlan, payload))
        .thenReturn(requestValidationPlan);
    when(consumerDelegationPlanService.buildPlan(routingPlan, requestValidationPlan, payload))
        .thenReturn(delegationPlan);
  }

  private Map<String, Object> listenerNoopPlan(boolean bridgeInvocationAllowed) {
    return Map.of(
        "validatorContractPlan",
        Map.of(
            "inputAdapterPlan",
            Map.of(
                "validatorInvocationGatePlan",
                Map.of(
                    "classificationBridgeGatePlan",
                    Map.of("bridgeInvocationAllowed", bridgeInvocationAllowed)))));
  }

  private Map<String, Object> listenerNoopPlanWithReturnThrowPolicyGate(
      boolean bridgeInvocationAllowed, boolean returnThrowPolicyChangeAllowed) {
    return Map.of(
        "validatorContractPlan",
        Map.of(
            "inputAdapterPlan",
            Map.of(
                "validatorInvocationGatePlan",
                Map.of(
                    "classificationBridgeGatePlan",
                    Map.of(
                        "bridgeInvocationAllowed",
                        bridgeInvocationAllowed,
                        "bridgeReturnThrowPolicyGatePlan",
                        Map.of(
                            "returnThrowPolicyChangeAllowed",
                            returnThrowPolicyChangeAllowed))))));
  }

  private Map<String, Object> listenerNoopPlanWithDecisionDryRunGate(
      boolean bridgeInvocationAllowed,
      boolean returnThrowPolicyChangeAllowed,
      boolean decisionDryRunInvocationAllowed) {
    return listenerNoopPlanWithDecisionDryRunGate(
        bridgeInvocationAllowed,
        returnThrowPolicyChangeAllowed,
        decisionDryRunInvocationAllowed,
        false);
  }

  private Map<String, Object> listenerNoopPlanWithDecisionDryRunGate(
      boolean bridgeInvocationAllowed,
      boolean returnThrowPolicyChangeAllowed,
      boolean decisionDryRunInvocationAllowed,
      boolean observationLoggingAllowed) {
    Map<String, Object> loggingGatePlan =
        Map.of(
            "observationLoggingAllowed",
            observationLoggingAllowed,
            "logExecuted",
            false,
            "databaseWriteExecuted",
            false,
            "rabbitAckExecuted",
            false,
            "rabbitNackExecuted",
            false);
    Map<String, Object> decisionInvocationGatePlan =
        Map.of(
            "decisionDryRunInvocationAllowed",
            decisionDryRunInvocationAllowed,
            "decisionOutputObservationLoggingGatePlan",
            loggingGatePlan);
    Map<String, Object> bridgeGatePlan =
        Map.of(
            "bridgeInvocationAllowed",
            bridgeInvocationAllowed,
            "bridgeReturnThrowPolicyGatePlan",
            Map.of("returnThrowPolicyChangeAllowed", returnThrowPolicyChangeAllowed),
            "bridgeDecisionDryRunInvocationGatePlan",
            decisionInvocationGatePlan);
    return Map.of(
        "validatorContractPlan",
        Map.of(
            "inputAdapterPlan",
            Map.of(
                "validatorInvocationGatePlan",
                Map.of("classificationBridgeGatePlan", bridgeGatePlan))));
  }

  private Message message(
      String payload,
      String messageId,
      String eventId,
      String idempotencyKey,
      String eventType,
      String templateKey) {
    MessageProperties properties = new MessageProperties();
    properties.setMessageId(messageId);
    properties.setHeader("eventId", eventId);
    properties.setHeader("idempotencyKey", idempotencyKey);
    properties.setHeader("eventType", eventType);
    properties.setHeader("templateKey", templateKey);
    return new Message(payload.getBytes(StandardCharsets.UTF_8), properties);
  }

  private String notificationRoutingListenerSource() throws IOException {
    Path modulePath =
        Path.of(
            "src",
            "main",
            "java",
            "cn",
            "yizuw",
            "magic",
            "backend",
            "messaging",
            "NotificationRoutingRabbitListener.java");
    Path workspacePath = Path.of("apps", "backend-springboot").resolve(modulePath);
    Path sourcePath = Files.exists(modulePath) ? modulePath : workspacePath;
    return Files.readString(sourcePath);
  }

  private List<Map<String, Object>> listenerNoopSafetyMatrix() {
    return List.of(
        listenerNoopSafetyMatrixRow(
            "delegation_blocked", false, false, false, "throw_delegation_blocked"),
        listenerNoopSafetyMatrixRow(
            "dedicated_consumer_non_ackable",
            true,
            false,
            false,
            "throw_non_ackable_result"),
        listenerNoopSafetyMatrixRow(
            "ackable_missing_adapter_plan",
            true,
            true,
            false,
            "return_to_container_policy"),
        listenerNoopSafetyMatrixRow(
            "ackable_blocked_adapter_plan",
            true,
            true,
            false,
            "return_to_container_policy"),
        listenerNoopSafetyMatrixRow(
            "ackable_ready_adapter_plan",
            true,
            true,
            true,
            "return_to_container_policy"));
  }

  private Map<String, Object> listenerNoopSafetyMatrixRow(
      String path,
      boolean dedicatedConsumerInvoked,
      boolean noopPlanInvoked,
      boolean noopAdapterPlanReady,
      String listenerOutcome) {
    Map<String, Object> row = new java.util.LinkedHashMap<>();
    row.put("path", path);
    row.put("dedicatedConsumerInvoked", dedicatedConsumerInvoked);
    row.put("noopPlanInvoked", noopPlanInvoked);
    row.put("noopAdapterPlanReady", noopAdapterPlanReady);
    row.put("listenerOutcome", listenerOutcome);
    row.put("validatorInvoked", false);
    row.put("manualExecutionInvoked", false);
    row.put("rabbitAckExecuted", false);
    row.put("rabbitNackExecuted", false);
    row.put("websocketExecuted", false);
    row.put("pushExecuted", false);
    return row;
  }

  private List<Map<String, Object>> futureBridgeInvocationPolicyMatrix() {
    return List.of(
        futureBridgeInvocationPolicyRow(
            "duplicate_without_send_plan",
            false,
            "return_without_bridge_for_duplicate",
            "return_to_container_policy"),
        futureBridgeInvocationPolicyRow(
            "consumed_adapter_blocked",
            true,
            "throw_before_classify_until_real_adapter_policy_batch",
            "throw_to_retry_or_dlq"),
        futureBridgeInvocationPolicyRow(
            "consumed_validation_blocked",
            true,
            "throw_for_retry_or_dlq_until_real_policy_batch",
            "throw_to_retry_or_dlq"),
        futureBridgeInvocationPolicyRow(
            "consumed_validation_ready",
            true,
            "return_deferred_until_manual_execution_result_is_verified",
            "return_to_container_policy_until_manual_execution_batch"));
  }

  private Map<String, Object> futureBridgeInvocationPolicyRow(
      String path,
      boolean bridgeInvocationExpected,
      String futureReturnThrowDecision,
      String listenerOutcome) {
    Map<String, Object> row = new java.util.LinkedHashMap<>();
    row.put("path", path);
    row.put("bridgeInvocationExpected", bridgeInvocationExpected);
    row.put("futureReturnThrowDecision", futureReturnThrowDecision);
    row.put("listenerOutcome", listenerOutcome);
    row.put("manualExecutionInvoked", false);
    row.put("rabbitAckExecuted", false);
    row.put("rabbitNackExecuted", false);
    return row;
  }

  private void assertAppearsInOrder(String source, String... fragments) {
    int previousIndex = -1;
    for (String fragment : fragments) {
      int index = source.indexOf(fragment, previousIndex + 1);
      assertThat(index)
          .as("source should contain fragment in order: %s", fragment)
          .isGreaterThan(previousIndex);
      previousIndex = index;
    }
  }

  private int countOccurrences(String source, String fragment) {
    int count = 0;
    int index = source.indexOf(fragment);
    while (index >= 0) {
      count++;
      index = source.indexOf(fragment, index + fragment.length());
    }
    return count;
  }
}

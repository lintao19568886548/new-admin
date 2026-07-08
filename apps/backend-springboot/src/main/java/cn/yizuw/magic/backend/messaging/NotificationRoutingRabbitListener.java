package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.messaging.rabbit.RabbitMqTopology;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** 共享 notification 队列通用路由入口；只允许已灰度的 route 真实委托。 */
@Component
@ConditionalOnProperty(
    prefix = "app.rabbit-mq",
    name = "consumer-enabled",
    havingValue = "true")
@ConditionalOnProperty(
    prefix = "app.rabbit-mq",
    name = "notification-routing-consumer-enabled",
    havingValue = "true")
public class NotificationRoutingRabbitListener {

  private static final Logger LOGGER =
      LoggerFactory.getLogger(NotificationRoutingRabbitListener.class);

  private final NotificationRoutingPlanService routingPlanService;
  private final NotificationDispatchPreflightService dispatchPreflightService;
  private final NotificationHandlerAdapterPlanService adapterPlanService;
  private final NotificationAdapterRequestValidationPlanService requestValidationPlanService;
  private final NotificationConsumerDelegationPlanService consumerDelegationPlanService;
  private final OrganizationProvisioningCompletedNotificationConsumerService
      organizationProvisioningCompletedNotificationConsumerService;
  private final NotificationInAppProviderListenerNoopPlanService listenerNoopPlanService;
  private final NotificationInAppProviderConsumerResultClassificationBridgeService
      consumerResultClassificationBridgeService;
  private final NotificationInAppProviderBridgeReturnThrowDecisionDryRunService
      bridgeReturnThrowDecisionDryRunService;
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService
      observationLogPayloadDryRunService;
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService
      observationLogDryRunService;
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService
      observationLogMessageDryRunService;
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService
      observationLoggerInvocationDryRunService;
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService
      observationLoggerExecutionPlanService;
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService
      observationEventConsumeLogWritePlanService;
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService
      observationEventConsumeLogRepositoryIntegrationPlanService;
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService
      observationEventConsumeLogRepositoryCallPlanService;
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService
      observationEventConsumeLogRecordSuccessExecutionGatePlanService;
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService
      observationEventConsumeLogRecordSuccessExecutionSwitchPlanService;
  private final NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService
      observationEventConsumeLogRecordSuccessExecutionAdapterPlanService;

  public NotificationRoutingRabbitListener(
      NotificationRoutingPlanService routingPlanService,
      NotificationDispatchPreflightService dispatchPreflightService,
      NotificationHandlerAdapterPlanService adapterPlanService,
      NotificationAdapterRequestValidationPlanService requestValidationPlanService,
      NotificationConsumerDelegationPlanService consumerDelegationPlanService,
      OrganizationProvisioningCompletedNotificationConsumerService
          organizationProvisioningCompletedNotificationConsumerService,
      NotificationInAppProviderListenerNoopPlanService listenerNoopPlanService,
      NotificationInAppProviderConsumerResultClassificationBridgeService
          consumerResultClassificationBridgeService,
      NotificationInAppProviderBridgeReturnThrowDecisionDryRunService
          bridgeReturnThrowDecisionDryRunService,
      NotificationInAppProviderBridgeReturnThrowDecisionObservationLogPayloadDryRunService
          observationLogPayloadDryRunService,
      NotificationInAppProviderBridgeReturnThrowDecisionObservationLogDryRunService
          observationLogDryRunService,
      NotificationInAppProviderBridgeReturnThrowDecisionObservationLogMessageDryRunService
          observationLogMessageDryRunService,
      NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerInvocationDryRunService
          observationLoggerInvocationDryRunService,
      NotificationInAppProviderBridgeReturnThrowDecisionObservationLoggerExecutionPlanService
          observationLoggerExecutionPlanService,
      NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogWritePlanService
          observationEventConsumeLogWritePlanService,
      NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryIntegrationPlanService
          observationEventConsumeLogRepositoryIntegrationPlanService,
      NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRepositoryCallPlanService
          observationEventConsumeLogRepositoryCallPlanService,
      NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionGatePlanService
          observationEventConsumeLogRecordSuccessExecutionGatePlanService,
      NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionSwitchPlanService
          observationEventConsumeLogRecordSuccessExecutionSwitchPlanService,
      NotificationInAppProviderBridgeReturnThrowDecisionObservationEventConsumeLogRecordSuccessExecutionAdapterPlanService
          observationEventConsumeLogRecordSuccessExecutionAdapterPlanService) {
    this.routingPlanService = routingPlanService;
    this.dispatchPreflightService = dispatchPreflightService;
    this.adapterPlanService = adapterPlanService;
    this.requestValidationPlanService = requestValidationPlanService;
    this.consumerDelegationPlanService = consumerDelegationPlanService;
    this.organizationProvisioningCompletedNotificationConsumerService =
        organizationProvisioningCompletedNotificationConsumerService;
    this.listenerNoopPlanService = listenerNoopPlanService;
    this.consumerResultClassificationBridgeService = consumerResultClassificationBridgeService;
    this.bridgeReturnThrowDecisionDryRunService = bridgeReturnThrowDecisionDryRunService;
    this.observationLogPayloadDryRunService = observationLogPayloadDryRunService;
    this.observationLogDryRunService = observationLogDryRunService;
    this.observationLogMessageDryRunService = observationLogMessageDryRunService;
    this.observationLoggerInvocationDryRunService = observationLoggerInvocationDryRunService;
    this.observationLoggerExecutionPlanService = observationLoggerExecutionPlanService;
    this.observationEventConsumeLogWritePlanService = observationEventConsumeLogWritePlanService;
    this.observationEventConsumeLogRepositoryIntegrationPlanService =
        observationEventConsumeLogRepositoryIntegrationPlanService;
    this.observationEventConsumeLogRepositoryCallPlanService =
        observationEventConsumeLogRepositoryCallPlanService;
    this.observationEventConsumeLogRecordSuccessExecutionGatePlanService =
        observationEventConsumeLogRecordSuccessExecutionGatePlanService;
    this.observationEventConsumeLogRecordSuccessExecutionSwitchPlanService =
        observationEventConsumeLogRecordSuccessExecutionSwitchPlanService;
    this.observationEventConsumeLogRecordSuccessExecutionAdapterPlanService =
        observationEventConsumeLogRecordSuccessExecutionAdapterPlanService;
  }

  /**
   * 监听 notification 主队列的通用路由入口。
   *
   * <p>本入口只在组织开通完成 notification 的委托矩阵全部通过时调用专用 consumer；
   * 其它共享队列消息继续抛错，避免被通用 listener 静默确认。
   */
  @RabbitListener(queues = RabbitMqTopology.QUEUE_NOTIFICATION)
  public void onMessage(Message message) {
    MessageProperties properties = message.getMessageProperties();
    String payload = new String(message.getBody(), StandardCharsets.UTF_8);
    Map<String, Object> routingPlan =
        routingPlanService.buildPlan(properties.getMessageId(), headers(properties), payload);
    Map<String, Object> dispatchPlan = dispatchPreflightService.buildPlan(routingPlan);
    Map<String, Object> adapterPlan =
        adapterPlanService.buildPlan(routingPlan, dispatchPlan, payload);
    Map<String, Object> requestValidationPlan =
        requestValidationPlanService.buildPlan(routingPlan, adapterPlan, payload);
    Map<String, Object> delegationPlan =
        consumerDelegationPlanService.buildPlan(routingPlan, requestValidationPlan, payload);
    if (Boolean.TRUE.equals(delegationPlan.get("delegationAllowed"))) {
      OrganizationProvisioningCompletedNotificationConsumeResult result =
          organizationProvisioningCompletedNotificationConsumerService.consume(
              organizationRequest(properties, payload));
      if (ackable(result)) {
        Map<String, Object> listenerNoopPlan =
            listenerNoopPlanService.buildPlan(resultAdapterPlanReady(delegationPlan));
        if (result.consumed() && classificationBridgeReady(listenerNoopPlan)) {
          if (bridgeDecisionDryRunInvocationReady(listenerNoopPlan)) {
            Map<String, Object> decisionDryRunPlan =
                bridgeReturnThrowDecisionDryRunService.decideDryRun(
                    result, bridgeReturnThrowPolicyGatePlan(listenerNoopPlan));
            Map<String, Object> loggingGatePlan =
                decisionOutputObservationLoggingGatePlan(listenerNoopPlan);
            Map<String, Object> payloadDryRunPlan =
                observationLogPayloadDryRunService.buildDryRun(
                    result,
                    decisionDryRunPlan,
                    loggingGatePlan);
            Map<String, Object> observationLogDryRunPlan =
                observationLogDryRunService.buildDryRun(payloadDryRunPlan, loggingGatePlan);
            Map<String, Object> messageDryRunPlan =
                observationLogMessageDryRunService.buildDryRun(observationLogDryRunPlan);
            Map<String, Object> loggerInvocationDryRunPlan =
                observationLoggerInvocationDryRunService.buildDryRun(
                    messageDryRunPlan, loggerInvocationGatePlan(loggingGatePlan));
            Map<String, Object> loggerExecutionPlan =
                observationLoggerExecutionPlanService.buildPlan(
                    loggerInvocationDryRunPlan, loggerExecutionGatePlan(loggingGatePlan));
            invokeLoggerIfPlanned(loggerExecutionPlan);
            Map<String, Object> recordSuccessExecutionSwitchExecutionPlan =
                observationEventConsumeLogRecordSuccessExecutionSwitchPlanService.buildPlan(
                    observationEventConsumeLogRecordSuccessExecutionGatePlanService.buildPlan(
                        observationEventConsumeLogRepositoryCallPlanService.buildPlan(
                            observationEventConsumeLogRepositoryIntegrationPlanService.buildPlan(
                                observationEventConsumeLogWritePlanService.buildPlan(
                                    loggerExecutionPlan,
                                    eventConsumeLogWriteGatePlan(loggingGatePlan)),
                                eventConsumeLogRepositoryMetadataPlan(properties))),
                        recordSuccessExecutionGatePlan()),
                    recordSuccessExecutionSwitchPlan());
            observationEventConsumeLogRecordSuccessExecutionAdapterPlanService.buildPlan(
                recordSuccessExecutionSwitchExecutionPlan, recordSuccessExecutionAdapterPlan());
          } else {
            consumerResultClassificationBridgeService.classifyDryRun(result);
          }
        }
        return;
      }
      throw new IllegalStateException(
          "notification dedicated consumer returned non-ackable result: status="
              + result.status()
              + ", reason="
              + result.reason()
              + ", eventId="
              + result.eventId());
    }
    throw new IllegalStateException(
        "notification consumer delegation blocked, message remains unconfirmed: route="
            + delegationPlan.get("route")
            + ", delegationAllowed="
            + delegationPlan.get("delegationAllowed")
            + ", failedChecks="
            + delegationPlan.get("delegationReadinessFailedChecks")
            + ", nextAction="
            + delegationPlan.get("nextAction"));
  }

  private OrganizationProvisioningCompletedNotificationConsumeRequest organizationRequest(
      MessageProperties properties, String payload) {
    return new OrganizationProvisioningCompletedNotificationConsumeRequest(
        header(properties, "eventId"),
        header(properties, "idempotencyKey"),
        properties.getMessageId(),
        payload,
        header(properties, "eventType"),
        header(properties, "templateKey"));
  }

  private boolean ackable(OrganizationProvisioningCompletedNotificationConsumeResult result) {
    return result.consumed() || result.duplicate();
  }

  private boolean resultAdapterPlanReady(Map<String, Object> delegationPlan) {
    Object value = delegationPlan.get("inAppProviderAutoExecutionAdapterPlan");
    if (value instanceof Map<?, ?> plan) {
      return "ready_for_result_adapter_dry_run".equals(String.valueOf(plan.get("planStatus")));
    }
    return false;
  }

  private boolean classificationBridgeReady(Map<String, Object> listenerNoopPlan) {
    Map<String, Object> bridgeGatePlan = classificationBridgeGatePlan(listenerNoopPlan);
    return Boolean.TRUE.equals(bridgeGatePlan.get("bridgeInvocationAllowed"));
  }

  private boolean bridgeDecisionDryRunInvocationReady(Map<String, Object> listenerNoopPlan) {
    Map<String, Object> bridgeGatePlan = classificationBridgeGatePlan(listenerNoopPlan);
    Map<String, Object> decisionGatePlan =
        mapValue(bridgeGatePlan.get("bridgeDecisionDryRunInvocationGatePlan"));
    return Boolean.TRUE.equals(decisionGatePlan.get("decisionDryRunInvocationAllowed"));
  }

  private Map<String, Object> bridgeReturnThrowPolicyGatePlan(
      Map<String, Object> listenerNoopPlan) {
    Map<String, Object> bridgeGatePlan = classificationBridgeGatePlan(listenerNoopPlan);
    return mapValue(bridgeGatePlan.get("bridgeReturnThrowPolicyGatePlan"));
  }

  private Map<String, Object> decisionOutputObservationLoggingGatePlan(
      Map<String, Object> listenerNoopPlan) {
    Map<String, Object> bridgeGatePlan = classificationBridgeGatePlan(listenerNoopPlan);
    Map<String, Object> decisionGatePlan =
        mapValue(bridgeGatePlan.get("bridgeDecisionDryRunInvocationGatePlan"));
    return mapValue(decisionGatePlan.get("decisionOutputObservationLoggingGatePlan"));
  }

  private Map<String, Object> loggerInvocationGatePlan(Map<String, Object> loggingGatePlan) {
    return Map.of(
        "loggerInvocationAllowed",
        Boolean.TRUE.equals(mapValue(loggingGatePlan).get("observationLoggingAllowed")));
  }

  private Map<String, Object> loggerExecutionGatePlan(Map<String, Object> loggingGatePlan) {
    return Map.of(
        "loggerExecutionAllowed",
        Boolean.TRUE.equals(mapValue(loggingGatePlan).get("observationLoggingAllowed")));
  }

  private Map<String, Object> eventConsumeLogWriteGatePlan(Map<String, Object> loggingGatePlan) {
    return Map.of(
        "eventConsumeLogWriteAllowed",
        Boolean.TRUE.equals(mapValue(loggingGatePlan).get("observationLoggingAllowed")));
  }

  private Map<String, Object> eventConsumeLogRepositoryMetadataPlan(MessageProperties properties) {
    return Map.of(
        "consumerGroup",
        "notification-in-app-provider-observation",
        "eventId",
        stringValue(header(properties, "eventId")),
        "eventType",
        stringValue(header(properties, "eventType")),
        "idempotencyKey",
        stringValue(header(properties, "idempotencyKey")),
        "topic",
        RabbitMqTopology.QUEUE_NOTIFICATION);
  }

  private Map<String, Object> recordSuccessExecutionGatePlan() {
    return Map.of("recordSuccessExecutionAllowed", false);
  }

  private Map<String, Object> recordSuccessExecutionSwitchPlan() {
    return Map.of(
        "recordSuccessExecutionSwitchProperty",
        "RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ENABLED",
        "recordSuccessExecutionSwitchAllowed",
        false);
  }

  private Map<String, Object> recordSuccessExecutionAdapterPlan() {
    return Map.of(
        "recordSuccessExecutionAdapterProperty",
        "RABBITMQ_NOTIFICATION_EVENT_CONSUME_LOG_RECORD_SUCCESS_ADAPTER_ENABLED",
        "recordSuccessExecutionAdapterAllowed",
        false);
  }

  private void invokeLoggerIfPlanned(Map<String, Object> loggerExecutionPlan) {
    Map<String, Object> plan = mapValue(loggerExecutionPlan);
    String formattedMessagePreview = stringValue(plan.get("formattedMessagePreview"));
    boolean loggerExecutionPlanned = Boolean.TRUE.equals(plan.get("loggerExecutionPlanned"));
    boolean infoLevelAllowed = "INFO".equals(stringValue(plan.get("allowedLogLevel")));
    boolean formattedMessageSourceAllowed =
        "formattedMessagePreview".equals(stringValue(plan.get("allowedMessageSource")));
    if (loggerExecutionPlanned
        && infoLevelAllowed
        && formattedMessageSourceAllowed
        && !formattedMessagePreview.isBlank()) {
      LOGGER.info(formattedMessagePreview);
    }
  }

  private Map<String, Object> classificationBridgeGatePlan(
      Map<String, Object> listenerNoopPlan) {
    Map<String, Object> contractPlan =
        mapValue(listenerNoopPlan == null ? null : listenerNoopPlan.get("validatorContractPlan"));
    Map<String, Object> inputAdapterPlan = mapValue(contractPlan.get("inputAdapterPlan"));
    Map<String, Object> validatorGatePlan =
        mapValue(inputAdapterPlan.get("validatorInvocationGatePlan"));
    return mapValue(validatorGatePlan.get("classificationBridgeGatePlan"));
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

  private Map<String, Object> headers(MessageProperties properties) {
    Map<String, Object> headers = new LinkedHashMap<>();
    copyHeader(properties, headers, "eventId");
    copyHeader(properties, headers, "eventType");
    copyHeader(properties, headers, "idempotencyKey");
    copyHeader(properties, headers, "templateKey");
    copyHeader(properties, headers, "source");
    return headers;
  }

  private void copyHeader(
      MessageProperties properties, Map<String, Object> headers, String name) {
    String value = header(properties, name);
    if (value != null) {
      headers.put(name, value);
    }
  }

  private String header(MessageProperties properties, String name) {
    Object value = properties.getHeaders().get(name);
    return value == null ? null : String.valueOf(value);
  }
}

package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** RabbitMQ listener 自动串联 in_app provider 前的综合安全门；只生成 dry-run 判定。 */
@Service
public class OrganizationProvisioningCompletedInAppListenerAutoExecutionGatePlanService {

  private final AppProperties appProperties;
  private final OrganizationProvisioningCompletedInAppListenerAutoExecutionInvocationPlanService
      invocationPlanService;

  public OrganizationProvisioningCompletedInAppListenerAutoExecutionGatePlanService(
      AppProperties appProperties,
      OrganizationProvisioningCompletedInAppListenerAutoExecutionInvocationPlanService
          invocationPlanService) {
    this.appProperties = appProperties;
    this.invocationPlanService = invocationPlanService;
  }

  /**
   * 生成 listener 自动执行前最终安全门。
   *
   * <p>本方法只输出自动执行是否满足条件，不调用手动执行 service，不确认 RabbitMQ 消息，也不推送
   * websocket/push。
   */
  public Map<String, Object> buildPlan(Map<String, Object> inAppExecutionPlan) {
    Map<String, Object> writePreview = mapValue(inAppExecutionPlan.get("writePreview"));
    Map<String, Object> preflightPlan = mapValue(inAppExecutionPlan.get("executorPreflightPlan"));
    Map<String, Object> insertPlan = mapValue(writePreview.get("notificationInsertPlan"));
    Map<String, Object> deliveryPlan = mapValue(writePreview.get("websocketPushDeliveryPlan"));
    List<Map<String, Object>> readinessMatrix =
        readinessMatrix(inAppExecutionPlan, preflightPlan, insertPlan, deliveryPlan);
    List<String> failedChecks = failedReadinessChecks(readinessMatrix);
    boolean allowed = failedChecks.isEmpty();

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put(
        "planType",
        "organization.provisioning.completed.notification.in_app.listener_auto_execution_gate");
    plan.put("planStatus", allowed ? "ready_for_listener_auto_execution_dry_run" : "blocked");
    plan.put("listenerAutoExecutionAllowed", allowed);
    plan.put("listenerAutoExecutionRequested", false);
    plan.put("listenerAutoExecutionExecuted", false);
    plan.put("listenerAutoExecutionGateEnabled", listenerAutoExecutionGateEnabled());
    plan.put("listenerIntegrationExecuted", false);
    plan.put("manualExecutionBean", inAppExecutionPlan.get("manualExecutionBean"));
    plan.put("executorBean", inAppExecutionPlan.get("executorBean"));
    plan.put("websocketExecuted", false);
    plan.put("pushExecuted", false);
    plan.put("executionBoundary", "第 175 批只生成 listener 自动执行综合安全门，不接 listener，不执行 provider");
    plan.put("readinessMatrix", readinessMatrix);
    plan.put("failedChecks", failedChecks);
    plan.put("blockedReasons", blockedReasons(readinessMatrix));
    plan.put(
        "invocationPlan",
        invocationPlanService.buildPlan(inAppExecutionPlan, failedChecks, allowed));
    plan.put("nextAction", nextAction(allowed));
    return plan;
  }

  private List<Map<String, Object>> readinessMatrix(
      Map<String, Object> executionPlan,
      Map<String, Object> preflightPlan,
      Map<String, Object> insertPlan,
      Map<String, Object> deliveryPlan) {
    List<Map<String, Object>> matrix = new ArrayList<>();
    matrix.add(
        readinessCheck(
            "listener_auto_execution_gate_enabled",
            listenerAutoExecutionGateEnabled(),
            listenerAutoExecutionGateEnabled()
                ? "listener 自动执行总开关已开启"
                : "RABBITMQ_ORGANIZATION_PROVISIONING_IN_APP_PROVIDER_LISTENER_AUTO_EXECUTION_ENABLED 未开启"));
    matrix.add(
        readinessCheck(
            "provider_send_gate_enabled",
            booleanValue(executionPlan.get("providerSendEnabled")),
            booleanValue(executionPlan.get("providerSendEnabled"))
                ? "provider 发送安全门已开启"
                : "RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_SEND_ENABLED 未开启或计划未携带"));
    matrix.add(
        readinessCheck(
            "provider_channel_guard_in_app",
            "in_app".equals(stringValue(executionPlan.get("providerChannelGuard"))),
            "in_app".equals(stringValue(executionPlan.get("providerChannelGuard")))
                ? "provider channel guard 限定为 in_app"
                : "provider channel guard 不是 in_app"));
    matrix.add(
        readinessCheck(
            "in_app_execution_plan_ready",
            "ready_for_write_plan".equals(stringValue(executionPlan.get("planStatus"))),
            "ready_for_write_plan".equals(stringValue(executionPlan.get("planStatus")))
                ? "in_app executionPlan 已 ready"
                : "in_app executionPlan 尚未 ready_for_write_plan"));
    matrix.add(
        readinessCheck(
            "manual_ddl_applied",
            appProperties.getRabbitMq().isOrganizationProvisioningInAppNotificationDdlApplied(),
            appProperties.getRabbitMq().isOrganizationProvisioningInAppNotificationDdlApplied()
                ? "in_app_notification 手工 DDL 已确认"
                : "in_app_notification 手工 DDL 未确认"));
    matrix.add(
        readinessCheck(
            "claim_gate_enabled",
            appProperties.getRabbitMq().isOrganizationProvisioningInAppProviderClaimEnabled(),
            appProperties.getRabbitMq().isOrganizationProvisioningInAppProviderClaimEnabled()
                ? "provider claim 安全门已开启"
                : "provider claim 安全门未开启"));
    matrix.add(
        readinessCheck(
            "notification_insert_gate_enabled",
            appProperties.getRabbitMq().isOrganizationProvisioningInAppNotificationInsertEnabled(),
            appProperties.getRabbitMq().isOrganizationProvisioningInAppNotificationInsertEnabled()
                ? "in_app_notification insert 安全门已开启"
                : "in_app_notification insert 安全门未开启"));
    matrix.add(
        readinessCheck(
            "mark_success_gate_enabled",
            appProperties.getRabbitMq().isOrganizationProvisioningInAppProviderMarkSuccessEnabled(),
            appProperties.getRabbitMq().isOrganizationProvisioningInAppProviderMarkSuccessEnabled()
                ? "provider markSuccess 安全门已开启"
                : "provider markSuccess 安全门未开启"));
    matrix.add(
        readinessCheck(
            "mark_failure_gate_enabled",
            appProperties.getRabbitMq().isOrganizationProvisioningInAppProviderMarkFailureEnabled(),
            appProperties.getRabbitMq().isOrganizationProvisioningInAppProviderMarkFailureEnabled()
                ? "provider markFailure 安全门已开启"
                : "provider markFailure 安全门未开启"));
    matrix.add(
        readinessCheck(
            "executor_preflight_ready",
            Boolean.TRUE.equals(preflightPlan.get("claimReady"))
                && "ready_for_claim_dry_run".equals(stringValue(preflightPlan.get("planStatus"))),
            Boolean.TRUE.equals(preflightPlan.get("claimReady"))
                ? "executor claim 预检已 ready"
                : "executor claim 预检未 ready"));
    matrix.add(
        readinessCheck(
            "notification_insert_plan_ready",
            "ready_for_insert_dry_run".equals(stringValue(insertPlan.get("planStatus"))),
            "ready_for_insert_dry_run".equals(stringValue(insertPlan.get("planStatus")))
                ? "notification insert 预案已 ready"
                : "notification insert 预案未 ready"));
    matrix.add(
        readinessCheck(
            "websocket_push_delivery_plan_ready",
            "ready_for_delivery_dry_run".equals(stringValue(deliveryPlan.get("planStatus"))),
            "ready_for_delivery_dry_run".equals(stringValue(deliveryPlan.get("planStatus")))
                ? "websocket/push dry-run 预案已 ready"
                : "websocket/push dry-run 预案未 ready"));
    matrix.add(
        readinessCheck(
            "listener_integration_side_effect_free",
            true,
            "第 175 批只生成安全门，不接 RabbitMQ listener，不执行 provider"));
    return matrix;
  }

  private Map<String, Object> readinessCheck(String name, boolean passed, String note) {
    Map<String, Object> check = new LinkedHashMap<>();
    check.put("name", name);
    check.put("passed", passed);
    check.put("note", note);
    return check;
  }

  private List<String> failedReadinessChecks(List<Map<String, Object>> readinessMatrix) {
    return readinessMatrix.stream()
        .filter(check -> !Boolean.TRUE.equals(check.get("passed")))
        .map(check -> stringValue(check.get("name")))
        .filter(StringUtils::hasText)
        .toList();
  }

  private List<String> blockedReasons(List<Map<String, Object>> readinessMatrix) {
    List<String> reasons = new ArrayList<>();
    for (Map<String, Object> check : readinessMatrix) {
      if (!Boolean.TRUE.equals(check.get("passed"))) {
        reasons.add(stringValue(check.get("note")));
      }
    }
    if (!reasons.isEmpty()) {
      reasons.add("未满足 listener 自动执行条件，本批仍只生成 dry-run 安全门");
    }
    return reasons.stream().filter(StringUtils::hasText).distinct().toList();
  }

  private String nextAction(boolean allowed) {
    if (allowed) {
      return "ready_for_future_listener_auto_execution_batch_but_current_plan_does_not_invoke_listener";
    }
    return "fix_listener_auto_execution_gate_blockers_before_listener_integration";
  }

  private boolean listenerAutoExecutionGateEnabled() {
    return appProperties
        .getRabbitMq()
        .isOrganizationProvisioningInAppProviderListenerAutoExecutionEnabled();
  }

  private Map<String, Object> mapValue(Object value) {
    if (!(value instanceof Map<?, ?> map)) {
      return Map.of();
    }
    Map<String, Object> result = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      result.put(String.valueOf(entry.getKey()), entry.getValue());
    }
    return result;
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

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

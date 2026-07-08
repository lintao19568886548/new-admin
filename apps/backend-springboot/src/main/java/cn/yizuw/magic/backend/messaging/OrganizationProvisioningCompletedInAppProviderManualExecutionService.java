package cn.yizuw.magic.backend.messaging;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * 组织开通完成 in_app provider 显式手动串联执行入口。
 *
 * <p>当前串联 `claim -> insertNotifications -> markSuccess`；insert/markSuccess 抛异常时可按
 * executor 安全门显式收口 `markFailure`。本 service 不接 RabbitMQ listener，不触发 websocket/push。
 */
@Service
public class OrganizationProvisioningCompletedInAppProviderManualExecutionService {

  public static final String EXECUTION_BOUNDARY =
      "第 173 批手动入口可在 insert/markSuccess 异常时按安全门 markFailure；仍不接 RabbitMQ listener，不推 websocket";

  private final OrganizationProvisioningCompletedInAppProviderExecutor executor;

  public OrganizationProvisioningCompletedInAppProviderManualExecutionService(
      OrganizationProvisioningCompletedInAppProviderExecutor executor) {
    this.executor = executor;
  }

  /**
   * 显式串联执行 in_app provider 三段动作。
   *
   * <p>调用方应传入 `inAppExecutionPlan`；本方法先校验 `executorPreflightPlan` 与
   * `writePreview.notificationInsertPlan` 都存在，再进入真实 executor。各段数据库写入仍由
   * executor 内部安全门分别控制。
   */
  public OrganizationProvisioningCompletedInAppProviderManualExecutionResult execute(
      Map<String, Object> inAppExecutionPlan) {
    Map<String, Object> plan = mapValue(inAppExecutionPlan);
    Map<String, Object> preflightPlan = mapValue(plan.get("executorPreflightPlan"));
    Map<String, Object> notificationInsertPlan = notificationInsertPlan(plan);
    if (preflightPlan.isEmpty() || notificationInsertPlan.isEmpty()) {
      return result(
          true,
          false,
          false,
          "manual_execution_plan_missing",
          "blocked",
          null,
          null,
          null,
          null,
          plan);
    }

    OrganizationProvisioningCompletedInAppProviderClaimResult claimResult =
        executor.claim(preflightPlan);
    if (!claimResult.accepted()) {
      return result(
          true,
          true,
          false,
          claimResult.reason(),
          "stopped_after_claim",
          claimResult,
          null,
          null,
          null,
          plan);
    }

    OrganizationProvisioningCompletedInAppNotificationInsertResult insertResult;
    try {
      insertResult = executor.insertNotifications(claimResult, notificationInsertPlan);
    } catch (RuntimeException error) {
      OrganizationProvisioningCompletedInAppProviderMarkFailureResult markFailureResult =
          executor.markFailure(claimResult, failureMessage("insertNotifications", error));
      return result(
          true,
          true,
          false,
          "insert_exception_mark_failure_attempted",
          "failed",
          claimResult,
          null,
          null,
          markFailureResult,
          plan);
    }
    if (!insertResult.accepted()) {
      return result(
          true,
          true,
          false,
          insertResult.reason(),
          "stopped_after_insert",
          claimResult,
          insertResult,
          null,
          null,
          plan);
    }

    OrganizationProvisioningCompletedInAppProviderMarkSuccessResult markSuccessResult;
    try {
      markSuccessResult = executor.markSuccess(claimResult, insertResult);
    } catch (RuntimeException error) {
      OrganizationProvisioningCompletedInAppProviderMarkFailureResult markFailureResult =
          executor.markFailure(claimResult, failureMessage("markSuccess", error));
      return result(
          true,
          true,
          false,
          "mark_success_exception_mark_failure_attempted",
          "failed",
          claimResult,
          insertResult,
          null,
          markFailureResult,
          plan);
    }
    return result(
        true,
        true,
        markSuccessResult.accepted(),
        markSuccessResult.reason(),
        markSuccessResult.status(),
        claimResult,
        insertResult,
        markSuccessResult,
        null,
        plan);
  }

  private OrganizationProvisioningCompletedInAppProviderManualExecutionResult result(
      boolean manualExecutionRequested,
      boolean manualExecutionExecuted,
      boolean manualExecutionCompleted,
      String reason,
      String status,
      OrganizationProvisioningCompletedInAppProviderClaimResult claimResult,
      OrganizationProvisioningCompletedInAppNotificationInsertResult insertResult,
      OrganizationProvisioningCompletedInAppProviderMarkSuccessResult markSuccessResult,
      OrganizationProvisioningCompletedInAppProviderMarkFailureResult markFailureResult,
      Map<String, Object> inAppExecutionPlan) {
    return new OrganizationProvisioningCompletedInAppProviderManualExecutionResult(
        manualExecutionRequested,
        manualExecutionExecuted,
        manualExecutionCompleted,
        false,
        false,
        false,
        reason,
        status,
        EXECUTION_BOUNDARY,
        claimResult,
        insertResult,
        markSuccessResult,
        markFailureResult,
        inAppExecutionPlan);
  }

  private String failureMessage(String stage, RuntimeException error) {
    String message = error.getMessage();
    if (message == null || message.isBlank()) {
      message = error.getClass().getSimpleName();
    }
    return "in_app provider manual execution failed at " + stage + ": " + message;
  }

  private Map<String, Object> notificationInsertPlan(Map<String, Object> inAppExecutionPlan) {
    Map<String, Object> writePreview = mapValue(inAppExecutionPlan.get("writePreview"));
    return mapValue(writePreview.get("notificationInsertPlan"));
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
}

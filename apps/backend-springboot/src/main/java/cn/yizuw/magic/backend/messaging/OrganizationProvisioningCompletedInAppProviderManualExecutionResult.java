package cn.yizuw.magic.backend.messaging;

import java.util.Map;

/** in_app provider 显式手动串联执行结果；当前不接 listener，也不推 websocket/push。 */
public record OrganizationProvisioningCompletedInAppProviderManualExecutionResult(
    boolean manualExecutionRequested,
    boolean manualExecutionExecuted,
    boolean manualExecutionCompleted,
    boolean listenerAutoExecution,
    boolean websocketExecuted,
    boolean pushExecuted,
    String reason,
    String status,
    String executionBoundary,
    OrganizationProvisioningCompletedInAppProviderClaimResult claimResult,
    OrganizationProvisioningCompletedInAppNotificationInsertResult insertResult,
    OrganizationProvisioningCompletedInAppProviderMarkSuccessResult markSuccessResult,
    OrganizationProvisioningCompletedInAppProviderMarkFailureResult markFailureResult,
    Map<String, Object> inAppExecutionPlan) {}

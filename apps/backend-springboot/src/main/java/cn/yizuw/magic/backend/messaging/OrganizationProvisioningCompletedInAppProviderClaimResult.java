package cn.yizuw.magic.backend.messaging;

import java.util.Map;

/** in_app provider 执行器认领结果；第 167 批只允许写消费日志 processing。 */
public record OrganizationProvisioningCompletedInAppProviderClaimResult(
    boolean accepted,
    boolean duplicate,
    boolean claimAttempted,
    boolean claimExecuted,
    boolean dbWriteExecuted,
    boolean markSuccessExecuted,
    boolean markFailureExecuted,
    EventConsumeClaimResult claimResult,
    String reason,
    String status,
    Map<String, Object> preflightPlan) {}

package cn.yizuw.magic.backend.messaging;

import java.util.Map;

/** in_app provider 消费日志失败收口结果；当前仍不触发 websocket/push。 */
public record OrganizationProvisioningCompletedInAppProviderMarkFailureResult(
    boolean accepted,
    boolean markFailureAttempted,
    boolean markFailureExecuted,
    boolean dbWriteExecuted,
    boolean websocketExecuted,
    boolean pushExecuted,
    String failureReason,
    String reason,
    String status,
    Map<String, Object> preflightPlan) {}

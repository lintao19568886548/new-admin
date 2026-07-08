package cn.yizuw.magic.backend.messaging;

import java.util.Map;

/** in_app provider 消费日志成功收口结果；当前仍不触发 websocket/push。 */
public record OrganizationProvisioningCompletedInAppProviderMarkSuccessResult(
    boolean accepted,
    boolean markSuccessAttempted,
    boolean markSuccessExecuted,
    boolean dbWriteExecuted,
    boolean websocketExecuted,
    boolean pushExecuted,
    String reason,
    String status,
    Map<String, Object> preflightPlan) {}

package cn.yizuw.magic.backend.messaging;

import java.util.Map;

/** RabbitMQ 组织开通完成 followup 轻任务消费结果；当前只生成后续计划。 */
public record OrganizationProvisioningCompletedFollowupConsumeResult(
    boolean consumed,
    boolean duplicate,
    String eventId,
    String idempotencyKey,
    Integer jobId,
    boolean notificationMessagePublished,
    String notificationMessageId,
    Map<String, Object> notificationPlan,
    boolean notificationPlanGenerated,
    Map<String, Object> redisRefreshPlan,
    boolean redisRefreshPlanGenerated,
    String reason,
    String status,
    String targetCustomerId,
    String targetDbName) {}

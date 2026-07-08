package cn.yizuw.magic.backend.messaging;

import java.util.Map;

/** RabbitMQ 组织开通完成 notification 消费结果；当前只做幂等和发送计划校验。 */
public record OrganizationProvisioningCompletedNotificationConsumeResult(
    boolean consumed,
    boolean duplicate,
    String eventId,
    String idempotencyKey,
    Integer jobId,
    Map<String, Object> sendPlan,
    boolean sendPlanGenerated,
    String reason,
    String status,
    String targetCustomerId,
    String targetDbName) {}

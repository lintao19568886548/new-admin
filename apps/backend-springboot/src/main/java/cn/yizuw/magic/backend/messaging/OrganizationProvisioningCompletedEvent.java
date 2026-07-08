package cn.yizuw.magic.backend.messaging;

/** 组织空间开通完成事件；表示中心库任务已完成，后续通知/审计仍由消息消费者处理。 */
public record OrganizationProvisioningCompletedEvent(
    String completedAt,
    Integer initiatorCenterUserId,
    int jobId,
    String lastPaymentOutTradeNo,
    String sourceCustomerId,
    Integer sourceOrgId,
    String status,
    String step,
    String targetCustomerId,
    String targetDbName) {}

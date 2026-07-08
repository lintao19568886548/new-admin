package cn.yizuw.magic.backend.messaging;

/** 组织空间开通任务人工重排事件；只表示任务已回到 pending，不执行真实开通。 */
public record OrganizationProvisioningRequeuedEvent(
    Integer initiatorCenterUserId,
    int jobId,
    String lastPaymentOutTradeNo,
    String operator,
    String previousStatus,
    String requeuedAt,
    String sourceCustomerId,
    Integer sourceOrgId,
    String status,
    String step,
    String targetCustomerId,
    String targetDbName) {}

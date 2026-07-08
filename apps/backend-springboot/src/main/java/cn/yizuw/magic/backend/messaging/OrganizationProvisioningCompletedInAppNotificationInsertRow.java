package cn.yizuw.magic.backend.messaging;

/** in_app_notification 单行写入参数；对应中心库手工 DDL 002。 */
public record OrganizationProvisioningCompletedInAppNotificationInsertRow(
    String eventId,
    String idempotencyKey,
    long recipientCenterUserId,
    String targetCustomerId,
    String targetDbName,
    String templateKey,
    String title,
    String content,
    String status,
    String payloadJson) {}

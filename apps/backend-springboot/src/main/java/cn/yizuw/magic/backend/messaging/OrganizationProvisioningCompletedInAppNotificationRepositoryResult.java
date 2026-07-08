package cn.yizuw.magic.backend.messaging;

/** in_app_notification repository 写入汇总；重复幂等键按 duplicate 计数。 */
public record OrganizationProvisioningCompletedInAppNotificationRepositoryResult(
    int requestedRows, int insertedRows, int duplicateRows) {}

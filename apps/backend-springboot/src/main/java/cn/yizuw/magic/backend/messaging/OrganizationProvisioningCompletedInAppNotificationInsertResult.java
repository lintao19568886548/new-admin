package cn.yizuw.magic.backend.messaging;

import java.util.Map;

/** in_app_notification 写入执行结果；第 169 批仍不更新消费日志成功状态。 */
public record OrganizationProvisioningCompletedInAppNotificationInsertResult(
    boolean accepted,
    boolean duplicate,
    boolean insertAttempted,
    boolean insertExecuted,
    boolean dbWriteExecuted,
    boolean markSuccessExecuted,
    boolean markFailureExecuted,
    int requestedRows,
    int insertedRows,
    int duplicateRows,
    String reason,
    String status,
    Map<String, Object> notificationInsertPlan) {}

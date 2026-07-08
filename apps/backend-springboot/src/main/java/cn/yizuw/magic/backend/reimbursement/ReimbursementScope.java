package cn.yizuw.magic.backend.reimbursement;

import java.util.List;

/** 报销数据范围：审核人员看授权园区，普通人员只看本人申请。 */
public record ReimbursementScope(
    boolean hasAuditPermission, Long tenantUserId, List<Integer> authorizedParkIds) {}

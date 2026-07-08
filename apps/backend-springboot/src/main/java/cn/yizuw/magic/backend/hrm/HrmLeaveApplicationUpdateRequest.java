package cn.yizuw.magic.backend.hrm;

/** 请假申请更新请求；字段与旧 Nitro 接口保持兼容，用户/园区名称由仓储层回填。 */
public record HrmLeaveApplicationUpdateRequest(
    Object auditUser,
    Object endDate,
    Object leaveType,
    Object parkId,
    Object reason,
    Object reply,
    Object startDate,
    Object status,
    Object user) {}

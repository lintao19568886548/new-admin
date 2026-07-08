package cn.yizuw.magic.backend.hrm;

/**
 * 请假申请新增请求。
 *
 * <p>兼容旧端 body 字段：申请人优先读取 {@code user}，未传时回退 {@code username}。
 */
public record HrmLeaveApplicationCreateRequest(
    Object auditUser,
    Object endDate,
    Object leaveType,
    Object parkId,
    Object reason,
    Object reply,
    Object startDate,
    Object status,
    Object user,
    Object username) {}

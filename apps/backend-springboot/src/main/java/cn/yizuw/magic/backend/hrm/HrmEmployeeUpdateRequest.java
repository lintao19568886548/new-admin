package cn.yizuw.magic.backend.hrm;

/**
 * HRM 员工更新请求。
 *
 * <p>只覆盖 employee 主表字段和 userId 软绑定；不触发组织生命周期、账号禁用或考勤重算。
 */
public record HrmEmployeeUpdateRequest(
    Object address,
    Object age,
    Object checkIn,
    Object checkOut,
    Object department,
    Object education,
    Object gender,
    Object hireDate,
    Object idNumber,
    Object isResigned,
    Object leaveDate,
    Object name,
    Object phone,
    Object remark,
    Object userId) {}

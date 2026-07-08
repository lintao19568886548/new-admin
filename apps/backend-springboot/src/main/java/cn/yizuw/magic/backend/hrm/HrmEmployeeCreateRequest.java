package cn.yizuw.magic.backend.hrm;

/**
 * HRM 员工新增请求。
 *
 * <p>兼容旧 Nitro 接口的宽松入参类型，只写 employee 主表和 userId 软绑定；不触发中心库账号生命周期、
 * 组织角色同步或考勤重算。
 */
public record HrmEmployeeCreateRequest(
    Object address,
    Object age,
    Object checkIn,
    Object checkOut,
    Object department,
    Object education,
    Object gender,
    Object hireDate,
    Object idNumber,
    Object isDeleted,
    Object isResigned,
    Object leaveDate,
    Object name,
    Object phone,
    Object remark,
    Object userId) {}

package cn.yizuw.magic.backend.hrm;

/** HR 员工列表查询参数，保持旧接口字段命名。 */
public record HrmEmployeeQuery(
    int currentPage,
    String department,
    String education,
    String gender,
    String hireDateEnd,
    String hireDateStart,
    String idNumber,
    String isDeleted,
    String isResigned,
    String name,
    int pageSize,
    String phone) {}

package cn.yizuw.magic.backend.hrm;

/** 请假申请列表查询参数，按旧接口 currentPage/pageSize/user/parkId/leaveType 绑定。 */
public record HrmLeaveApplicationQuery(
    int currentPage, int pageSize, String user, String parkId, String leaveType) {}

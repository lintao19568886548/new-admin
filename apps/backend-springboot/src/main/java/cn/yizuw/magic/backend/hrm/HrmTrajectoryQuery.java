package cn.yizuw.magic.backend.hrm;

/** HR 考勤轨迹列表查询参数，兼容旧接口 page/pageSize/employeeName/parkId/date 字段。 */
public record HrmTrajectoryQuery(
    int page, int pageSize, String employeeName, String parkId, String startDate, String endDate) {}

package cn.yizuw.magic.backend.hrm;

/** 考勤列表/统计查询参数，保持旧 Nitro 接口的 page/pageSize/username/date 字段。 */
public record HrmAttendanceQuery(
    int page, int pageSize, String startDate, String endDate, String username) {}

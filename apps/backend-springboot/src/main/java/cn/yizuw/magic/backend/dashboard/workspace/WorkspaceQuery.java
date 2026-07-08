package cn.yizuw.magic.backend.dashboard.workspace;

/** 工作台访问日志分页查询参数。 */
public record WorkspaceQuery(
    Integer currentPage, String endTime, Integer pageSize, String startTime) {}

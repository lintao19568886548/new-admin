package cn.yizuw.magic.backend.dashboard.overview;

/** 看板统计接口通用查询参数，兼容旧 Nitro 接口的 date/startDate/endDate/year/parkId。 */
public record DashboardOverviewQuery(
    String date, String endDate, String parkId, String startDate, Integer year) {}

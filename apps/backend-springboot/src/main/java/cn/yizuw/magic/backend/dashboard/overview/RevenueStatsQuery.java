package cn.yizuw.magic.backend.dashboard.overview;

/** 营收看板查询参数，兼容旧 Nitro `/dashboard/revenue-stats` 的日期和园区筛选。 */
public record RevenueStatsQuery(
    String date, String endDate, String month, String parkId, String startDate) {}

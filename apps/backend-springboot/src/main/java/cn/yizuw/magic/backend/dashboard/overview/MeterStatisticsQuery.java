package cn.yizuw.magic.backend.dashboard.overview;

/** 表计统计查询参数，兼容旧接口 type/dateType/date/parkId/startDate/endDate/projCode。 */
public record MeterStatisticsQuery(
    String date,
    String dateType,
    String endDate,
    String parkId,
    String startDate,
    String type,
    String projCode) {}

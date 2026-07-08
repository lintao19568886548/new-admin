package cn.yizuw.magic.backend.investment;

/** 招商雷达线索关闭请求；只支持旧端成交或失效两个终态。 */
public record RadarLeadCloseRequest(String reason, String stage) {}

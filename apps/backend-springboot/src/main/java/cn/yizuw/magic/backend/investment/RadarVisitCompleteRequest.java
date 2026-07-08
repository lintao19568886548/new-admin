package cn.yizuw.magic.backend.investment;

/** 招商雷达带看完成请求，只写带看记录和线索阶段。 */
public record RadarVisitCompleteRequest(String actualTime, String feedback) {}

package cn.yizuw.magic.backend.investment;

/** 招商雷达线索带看预约请求，不触发房源匹配重建或外部通知。 */
public record RadarLeadVisitRequest(
    Object factoryFloorId,
    String feedback,
    String scheduledTime,
    String visitorName,
    String visitorPhone) {}

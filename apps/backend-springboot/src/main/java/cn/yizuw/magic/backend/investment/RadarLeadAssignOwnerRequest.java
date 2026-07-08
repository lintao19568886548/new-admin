package cn.yizuw.magic.backend.investment;

/** 招商雷达线索负责人分配请求，仅写本地线索负责人和分配日志。 */
public record RadarLeadAssignOwnerRequest(Object ownerUserId, String assignReason) {}

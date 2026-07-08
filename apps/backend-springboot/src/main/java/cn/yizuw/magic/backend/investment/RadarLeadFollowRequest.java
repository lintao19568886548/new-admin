package cn.yizuw.magic.backend.investment;

/** 招商雷达线索跟进请求；写本地跟进记录，并按旧端规则推进线索阶段。 */
public record RadarLeadFollowRequest(
    String content,
    String followResult,
    String followType,
    String invalidReason,
    String nextAction,
    String nextFollowTime) {}

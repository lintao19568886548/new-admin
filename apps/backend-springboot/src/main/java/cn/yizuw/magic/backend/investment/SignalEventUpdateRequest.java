package cn.yizuw.magic.backend.investment;

/** 招商雷达企业信号状态更新请求，只允许旧端定义的状态枚举。 */
public record SignalEventUpdateRequest(String status) {}

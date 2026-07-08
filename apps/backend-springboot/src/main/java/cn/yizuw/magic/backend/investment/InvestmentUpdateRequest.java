package cn.yizuw.magic.backend.investment;

import java.math.BigDecimal;

/** 招商项目更新请求，只覆盖旧主表 `investment` 的低副作用字段。 */
public record InvestmentUpdateRequest(
    String agentName,
    Object investmentId,
    BigDecimal intentArea,
    String intentLevel,
    String meetingTime,
    Object parkId,
    String phoneNumber,
    String progress,
    String remark,
    String tenantName) {}

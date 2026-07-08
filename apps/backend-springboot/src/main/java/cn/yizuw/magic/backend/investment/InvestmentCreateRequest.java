package cn.yizuw.magic.backend.investment;

import java.math.BigDecimal;

/**
 * 招商项目新增请求。
 *
 * <p>只开放旧 investment 主表字段；图片关系、跟进记录和雷达线索转换不进入本批迁移。
 */
public record InvestmentCreateRequest(
    String agentName,
    BigDecimal intentArea,
    String intentLevel,
    String meetingTime,
    Object parkId,
    String phoneNumber,
    String progress,
    String remark,
    String tenantName) {}

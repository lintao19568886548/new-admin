package cn.yizuw.magic.backend.rental.tenant;

import java.math.BigDecimal;

/** 租户更新请求；第四十四批只写 rental_tenant 主表字段，图片和财务同步留到后续专项批次。 */
public record RentalTenantUpdateRequest(
    String address,
    BigDecimal area,
    String contractEnd,
    String contractStart,
    String increaseData,
    String increaseDate,
    BigDecimal increaseRate,
    Object parkId,
    BigDecimal penaltyRate,
    String phoneNumber,
    String remark,
    BigDecimal rent,
    String sendMessage,
    String status,
    String tenantName,
    Object transactionType) {}

package cn.yizuw.magic.backend.rental.tenant;

import java.math.BigDecimal;

/**
 * 租户新增请求。
 *
 * <p>第 62 批只写 {@code rental_tenant} 主表；租户图片关系和租赁月度支出财务同步仍保留给后续专项批次。
 */
public record RentalTenantCreateRequest(
    String address,
    BigDecimal area,
    String contractEnd,
    String contractStart,
    String increaseData,
    String increaseDate,
    BigDecimal increaseRate,
    Object images,
    Object parkId,
    BigDecimal penaltyRate,
    String phoneNumber,
    String remark,
    BigDecimal rent,
    String sendMessage,
    String status,
    String tenantName,
    Object transactionType) {}

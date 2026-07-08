package cn.yizuw.magic.backend.sms;

/** 单条租户合同提醒短信请求，兼容旧 `/api/sms/send` 入参。 */
public record SmsSendRequest(
    String contractEndDate,
    String increaseDate,
    String phoneNumber,
    Object rentalTenantId,
    String tenantName) {}

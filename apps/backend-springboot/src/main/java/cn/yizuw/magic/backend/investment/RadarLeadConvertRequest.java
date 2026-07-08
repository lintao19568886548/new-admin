package cn.yizuw.magic.backend.investment;

/** 招商雷达线索转换请求，兼容旧端 `ownerUserId` 可传数字、字符串或 null 的 body。 */
public record RadarLeadConvertRequest(Object ownerUserId, String remark) {}

package cn.yizuw.magic.backend.smartmeter;

/**
 * 智能水电表品牌新增/更新请求。
 *
 * <p>旧 Nitro 只允许 {@code meterType=electric|water}；业务层会统一修剪文本、归一化品牌编码和布尔值。
 */
public record SmartMeterBrandRequest(
    String apiEndpoint,
    String appKey,
    String appSecretRef,
    String brandCode,
    String brandName,
    Object enabled,
    Object isDefault,
    String meterType,
    String protocolType,
    String remark) {}

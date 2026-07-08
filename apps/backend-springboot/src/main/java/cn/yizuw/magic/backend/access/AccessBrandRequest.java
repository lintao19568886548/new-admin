package cn.yizuw.magic.backend.access;

/**
 * 门禁品牌新增/更新请求。
 *
 * <p>字段来自旧 Nitro `access/brand` 接口；业务层会统一修剪文本、归一化品牌编码和布尔值。
 */
public record AccessBrandRequest(
    String apiEndpoint,
    String appKey,
    String appSecretRef,
    String brandCode,
    String brandName,
    Object enabled,
    Object isDefault,
    String protocolType,
    String remark) {}

package cn.yizuw.magic.backend.factory;

/**
 * 旧厂房新增请求。
 *
 * <p>第 62 批只写 {@code factory} 主表；旧 Nitro 支持的 {@code floors} 嵌套楼层和楼层图片关系仍保留在旧后端。
 */
public record FactoryCreateRequest(
    Object address,
    Object buildTime,
    Object contact,
    Object description,
    Object factoryName,
    Object floors,
    Object isOwn,
    Object parkId) {}

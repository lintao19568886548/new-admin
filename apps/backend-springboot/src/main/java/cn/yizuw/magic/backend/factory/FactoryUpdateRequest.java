package cn.yizuw.magic.backend.factory;

/**
 * 旧厂房更新请求。
 *
 * <p>旧 Nitro 会在同一个请求里重建 floors 和楼层图片关系；迁移期只更新 {@code factory} 主表白名单字段，
 * {@code floors} 仅用于兼容前端请求体结构。
 */
public record FactoryUpdateRequest(
    Object address,
    Object buildTime,
    Object contact,
    Object description,
    Object factoryName,
    Object floors,
    Object isOwn,
    Object parkId) {}

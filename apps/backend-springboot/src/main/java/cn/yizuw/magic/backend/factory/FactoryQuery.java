package cn.yizuw.magic.backend.factory;

/**
 * 厂房列表查询条件。
 *
 * <p>字段名保持和前端/旧 Nitro 接口一致，避免迁移期同时改前端参数。
 */
public record FactoryQuery(
    String address,
    Integer currentPage,
    String factoryName,
    Boolean isOwn,
    Integer pageSize,
    Integer parkId,
    String status) {}

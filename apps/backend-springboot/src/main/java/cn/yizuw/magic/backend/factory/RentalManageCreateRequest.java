package cn.yizuw.magic.backend.factory;

/**
 * 租赁管理厂房新增请求。
 *
 * <p>第 59 批只迁移 factory 主表创建；楼层、图片和租赁账单联动仍保留在旧 Nitro 后端。
 */
public record RentalManageCreateRequest(
    Object address,
    Object buildTime,
    Object contact,
    Object description,
    Object factoryName,
    Object isOwn,
    Object parkId) {}

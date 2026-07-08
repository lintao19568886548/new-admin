package cn.yizuw.magic.backend.factory;

/** 租赁管理厂房更新请求；仅开放 factory 主表字段，楼层和图片仍由旧后端接口处理。 */
public record RentalManageUpdateRequest(
    Object address,
    Object buildTime,
    Object contact,
    Object description,
    Object factoryName,
    Object isOwn,
    Object parkId) {}

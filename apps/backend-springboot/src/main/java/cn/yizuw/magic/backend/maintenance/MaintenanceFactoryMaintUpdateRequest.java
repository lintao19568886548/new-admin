package cn.yizuw.magic.backend.maintenance;

/** 厂房维护更新请求；字段限定在旧 factory_maintenance 主表。 */
public record MaintenanceFactoryMaintUpdateRequest(
    Object endTime,
    Object factoryId,
    Object maintenanceItem,
    Object maintenanceStatus,
    Object parkId,
    Object personInCharge,
    Object remark,
    Object startTime) {}

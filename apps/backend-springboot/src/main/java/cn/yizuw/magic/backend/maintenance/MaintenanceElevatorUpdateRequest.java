package cn.yizuw.magic.backend.maintenance;

/** 升降机更新请求；字段来自旧 Prisma 模型并兼容真实库可能存在的 area/brand 字段。 */
public record MaintenanceElevatorUpdateRequest(
    Object area,
    Object brand,
    Object checkTime,
    Object checker,
    Object factoryId,
    Object loadCapacity,
    Object name,
    Object parkId,
    Object productionDate,
    Object remark,
    Object size,
    Object status) {}

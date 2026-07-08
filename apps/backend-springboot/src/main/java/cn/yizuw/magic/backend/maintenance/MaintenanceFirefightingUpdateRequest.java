package cn.yizuw.magic.backend.maintenance;

/** 消防设施更新请求；只允许写入旧 firefighting 主表字段，不处理图片关系表。 */
public record MaintenanceFirefightingUpdateRequest(
    Object address,
    Object checker,
    Object checkTime,
    Object extinguisher,
    Object factoryId,
    Object fireExit,
    Object firefightingName,
    Object hydrant,
    Object imgUrl,
    Object parkId,
    Object remark) {}

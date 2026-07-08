package cn.yizuw.magic.backend.maintenance;

/**
 * 报修工单新增请求。
 *
 * <p>字段来自旧 Nitro `maintenance/repair-order` 接口；本批只接入新增，更新和删除留到下一批。
 */
public record MaintenanceRepairOrderRequest(
    Object acceptTime,
    Object assignee,
    Object assigneePhone,
    Object confirmTime,
    Object description,
    Object factoryId,
    Object finishTime,
    Object images,
    Object orderNo,
    Object parkId,
    Object priority,
    Object processImages,
    Object processRemark,
    Object repairType,
    Object source,
    Object status,
    Object tenantId,
    Object tenantName,
    Object tenantPhone) {}

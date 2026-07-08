package cn.yizuw.magic.backend.maintenance;

/** 报修工单列表查询条件，单独建模避免污染其它维保子模块查询对象。 */
public record MaintenanceRepairOrderQuery(
    String assignee,
    Integer currentPage,
    Integer currentPark,
    String endTime,
    Integer factoryId,
    String orderNo,
    Integer pageSize,
    Integer parkId,
    String priority,
    String repairType,
    String startTime,
    String status,
    String tenantName) {}

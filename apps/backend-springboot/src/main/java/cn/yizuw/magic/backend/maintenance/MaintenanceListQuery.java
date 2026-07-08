package cn.yizuw.magic.backend.maintenance;

/**
 * 维保模块列表查询条件。
 *
 * <p>三个旧模块的筛选字段有重叠也有差异，用一个不可变查询对象承载，避免 Controller 和
 * Repository 之间传递过长的散列参数。
 */
public record MaintenanceListQuery(
    String address,
    String area,
    String brand,
    String checkItems,
    String checkResult,
    String checker,
    String checkTimeEnd,
    String checkTimeStart,
    Integer currentPage,
    Integer currentPark,
    String extinguisher,
    Integer factoryId,
    String fireExit,
    String firefightingName,
    String hydrant,
    String loadCapacity,
    String maintenanceItem,
    String maintenanceStatus,
    String name,
    Integer pageSize,
    Integer parkId,
    String personInCharge,
    String productionDateEnd,
    String productionDateStart,
    String size,
    String specifications,
    String status,
    String transformerName) {}

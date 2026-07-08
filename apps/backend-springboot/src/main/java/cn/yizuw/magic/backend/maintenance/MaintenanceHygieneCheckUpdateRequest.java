package cn.yizuw.magic.backend.maintenance;

/** 卫生检查更新请求；字段限定在旧 hygiene_check 主表。 */
public record MaintenanceHygieneCheckUpdateRequest(
    Object checkDate,
    Object checker,
    Object checkItems,
    Object checkResult,
    Object factoryId,
    Object parkId,
    Object remark) {}

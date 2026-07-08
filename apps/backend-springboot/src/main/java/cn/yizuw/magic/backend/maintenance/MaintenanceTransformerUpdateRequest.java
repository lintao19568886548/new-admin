package cn.yizuw.magic.backend.maintenance;

/** 变压器更新请求；字段限定在旧 transformer 主表，避免整包 body 误写。 */
public record MaintenanceTransformerUpdateRequest(
    Object address,
    Object checker,
    Object checkTime,
    Object contact,
    Object factoryId,
    Object imgUrl,
    Object parkId,
    Object remark,
    Object specifications,
    Object status,
    Object transformerName) {}

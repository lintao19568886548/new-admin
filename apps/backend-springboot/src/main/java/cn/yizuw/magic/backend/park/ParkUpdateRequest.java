package cn.yizuw.magic.backend.park;

/** 系统园区更新请求；字段与旧 Nitro 的 system/park 更新接口保持一致。 */
public record ParkUpdateRequest(
    Object address,
    Object area,
    Object description,
    Object parkName,
    Object status) {}

package cn.yizuw.magic.backend.access;

/** 车辆出入记录更新请求，字段对应旧 `access/car/[id].put.ts` 可写模型。 */
public record AccessCarUpdateRequest(
    String carNumber, Object parkId, String registerTime, String remark, Object status) {}

package cn.yizuw.magic.backend.access;

/** 新增车辆出入记录请求，对应旧 `access/car/.post.ts` 表单字段。 */
public record AccessCarCreateRequest(
    String carNumber, Object parkId, String registerTime, String remark, Object status) {}

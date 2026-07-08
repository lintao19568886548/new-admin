package cn.yizuw.magic.backend.access;

/** 访客出入记录更新请求，字段对应旧 `access/visitor/[id].put.ts` 可写模型。 */
public record AccessVisitorUpdateRequest(
    String carNum,
    Object parkId,
    String phoneNumber,
    String registerTime,
    String remark,
    Object status,
    String visitorName) {}

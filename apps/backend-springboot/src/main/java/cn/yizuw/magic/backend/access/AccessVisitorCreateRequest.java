package cn.yizuw.magic.backend.access;

/** 新增访客出入记录请求，对应旧 `access/visitor/.post.ts` 表单字段。 */
public record AccessVisitorCreateRequest(
    String carNum,
    Object parkId,
    String phoneNumber,
    String registerTime,
    String remark,
    Object status,
    String visitorName) {}

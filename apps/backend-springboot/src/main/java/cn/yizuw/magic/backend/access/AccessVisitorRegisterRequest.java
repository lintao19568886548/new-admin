package cn.yizuw.magic.backend.access;

/** 公开访客登记请求，兼容旧移动端 `/api/access/visitor/register`。 */
public record AccessVisitorRegisterRequest(
    String carNum,
    String phoneNumber,
    String registerTime,
    String remark,
    Object status,
    String visitorName) {}

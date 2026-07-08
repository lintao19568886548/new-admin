package cn.yizuw.magic.backend.access;

/** 新增门禁设备请求，对应旧 `access/door/.post.ts` 的白名单字段。 */
public record AccessDoorCreateRequest(
    String deviceCode, String deviceName, String location, Object parkId, Object status) {}

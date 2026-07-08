package cn.yizuw.magic.backend.access;

/** 门禁设备状态更新请求；旧接口只允许更新 status。 */
public record AccessDoorStatusRequest(Object status) {}

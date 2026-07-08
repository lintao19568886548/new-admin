package cn.yizuw.magic.backend.localization;

/** 打卡定位更新请求，只暴露旧接口允许修改的四个字段。 */
public record LocalizationUpdateRequest(
    Object latitude, Object longitude, Object punchTime, Object status) {}

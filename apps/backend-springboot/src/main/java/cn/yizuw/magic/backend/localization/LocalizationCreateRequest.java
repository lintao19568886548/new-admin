package cn.yizuw.magic.backend.localization;

/** 打卡定位新增请求；旧接口要求 punchTime、status、longitude、latitude 四个字段必填。 */
public record LocalizationCreateRequest(
    Object latitude, Object longitude, Object punchTime, Object status) {}

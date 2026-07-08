package cn.yizuw.magic.backend.localization;

/** 打卡定位列表查询参数，已在 Service 层完成分页默认值归一化。 */
public record LocalizationQuery(Integer currentPage, Integer pageSize, String username) {}

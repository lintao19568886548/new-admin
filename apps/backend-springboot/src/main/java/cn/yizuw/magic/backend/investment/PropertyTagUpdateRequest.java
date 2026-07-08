package cn.yizuw.magic.backend.investment;

/** 招商雷达房源标签更新请求，兼容旧端 `tags` 与 `tagsJson` 两种入参。 */
public record PropertyTagUpdateRequest(Object tags, Object tagsJson) {}

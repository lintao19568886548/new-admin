package cn.yizuw.magic.backend.investment;

import java.util.List;

/** 招商雷达采集源配置更新请求，不触发采集任务执行或 catalog seed。 */
public record CrawlerSourceUpdateRequest(
    List<String> allowedPathsJson,
    List<String> blockedPathsJson,
    Object crawlIntervalMinutes,
    Object enabled,
    List<String> keywordExcludeJson,
    List<String> keywordIncludeJson,
    Object rateLimitPerMinute,
    List<String> regionScopeJson,
    String robotsUrl) {}

package cn.yizuw.magic.backend.investment;

/** 招商雷达卡住的 RUNNING 采集 URL 回收请求；只更新本地任务项重试状态。 */
public record CrawlerTaskItemReclaimRequest(
    Object sourceId,
    Object sourceCode,
    Object staleMinutes) {}

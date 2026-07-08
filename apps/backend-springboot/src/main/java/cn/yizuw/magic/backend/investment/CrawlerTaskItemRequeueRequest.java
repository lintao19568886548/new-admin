package cn.yizuw.magic.backend.investment;

import java.util.List;

/** 招商雷达采集 URL 重新入队请求；只重置本地任务项状态，不启动爬虫执行。 */
public record CrawlerTaskItemRequeueRequest(
    Object sourceId,
    Object sourceCode,
    List<Object> itemIds,
    List<Object> statuses) {}

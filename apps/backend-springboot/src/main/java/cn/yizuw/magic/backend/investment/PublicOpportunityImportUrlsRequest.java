package cn.yizuw.magic.backend.investment;

import java.util.List;

/** 批量导入公开机会采集 URL 请求；只写 crawler_task_item，不进行页面抓取。 */
public record PublicOpportunityImportUrlsRequest(
    Object sourceCode,
    List<Object> urls,
    Object urlText,
    Object maxRetryCount,
    Object requeueExisting) {}

package cn.yizuw.magic.backend.investment;

/**
 * 公开机会 URL 采集单次运行参数。
 *
 * <p>迁移期 Spring Boot 只用这些参数创建本地 `crawler_task` 队列记录，真实抓取后续交给
 * XXL-Job/Kafka worker 接管。
 */
public record PublicOpportunityCrawlerRunRequest(
    Object batchSize,
    Object discoverList,
    Object freshnessDays,
    Object ignoreInterval,
    Object listDiscoveryDelayMs,
    Object maxListPages,
    Object maxRetryCount,
    Object reprocessSuccess,
    Object retryDelayMinutes,
    Object staleReprocessMinutes,
    Object sourceCode) {}

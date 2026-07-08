package cn.yizuw.magic.backend.investment;

/**
 * 公开机会多平台批量采集参数。
 *
 * <p>旧 Nitro 会立即并发抓取多个平台；Spring Boot 迁移期只创建本地任务批次，不触发外部网络。
 */
public record PublicOpportunityBatchRunRequest(
    Object batchSize,
    Object continueOnError,
    Object discoverList,
    Object freshnessDays,
    Object ignoreInterval,
    Object listDiscoveryDelayMs,
    Object maxConcurrency,
    Object maxListPages,
    Object maxRetryCount,
    Object maxRounds,
    Object mode,
    Object reprocessSuccess,
    Object retryDelayMinutes,
    Object staleReprocessMinutes,
    Object targetCount) {}

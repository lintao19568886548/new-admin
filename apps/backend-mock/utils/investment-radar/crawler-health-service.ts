import type { CrawlerSource } from './crawler-types';

import { prismaClient } from '~/utils/db';

import { tableExists, toNumber, toRate } from './analytics-service';
import { ensureCrawlerSourceCatalog } from './crawler-source-repository';
import { PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES } from './crawler-types';
import { getPublicOpportunityCrawlerSchedulerRuntimeStatus } from './public-opportunity-crawler-scheduler';

export interface PublicCrawlerHealthSourceItem {
  failedItems: number;
  failedTasks: number;
  healthStatus: 'BLOCKED' | 'DISABLED' | 'HEALTHY' | 'STALE' | 'WARNING';
  latestError?: null | string;
  latestTaskId?: null | number;
  latestTaskStatus?: null | string;
  pendingItems: number;
  sourceCode: string;
  sourceId: number;
  sourceName: string;
  successItems: number;
  successRate: number;
  totalItems: number;
  zeroOutputTaskCount: number;
}

function normalizeJsonArray(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function mapSource(row: any): CrawlerSource {
  return {
    adapterStatus: row.adapterStatus || undefined,
    allowedPathsJson: normalizeJsonArray(row.allowedPathsJson),
    baseUrl: row.baseUrl || '',
    blockedPathsJson: normalizeJsonArray(row.blockedPathsJson),
    crawlIntervalMinutes: Number(row.crawlIntervalMinutes || 0),
    enabled: Boolean(row.enabled),
    keywordExcludeJson: normalizeJsonArray(row.keywordExcludeJson),
    keywordIncludeJson: normalizeJsonArray(row.keywordIncludeJson),
    lastCrawledAt: row.lastCrawledAt || null,
    rateLimitPerMinute: Number(row.rateLimitPerMinute || 0),
    regionScopeJson: normalizeJsonArray(row.regionScopeJson),
    robotsUrl: row.robotsUrl || null,
    sourceCode: row.sourceCode || '',
    sourceId: Number(row.sourceId || 0),
    sourceName: row.sourceName || '',
    sourceType: row.sourceType || '',
    updateTime: row.updateTime || null,
  };
}

function resolveHealthStatus(input: {
  enabled: boolean;
  failedItems: number;
  failedTasks: number;
  latestError?: null | string;
  pendingItems: number;
  successRate: number;
  totalItems: number;
  zeroOutputTaskCount: number;
}): PublicCrawlerHealthSourceItem['healthStatus'] {
  if (!input.enabled) {
    return 'DISABLED';
  }
  if (
    input.latestError &&
    /403|captcha|forbidden|anti|blocked|timeout|ECONN|ENOTFOUND/i.test(
      input.latestError,
    )
  ) {
    return 'BLOCKED';
  }
  if (input.failedTasks > 0 || input.zeroOutputTaskCount > 0) {
    return 'WARNING';
  }
  if (input.totalItems > 0 && input.successRate < 50) {
    return 'STALE';
  }
  if (input.pendingItems > 0 && input.successRate === 0) {
    return 'STALE';
  }
  return 'HEALTHY';
}

export async function getPublicCrawlerHealthSummary() {
  await ensureCrawlerSourceCatalog();

  const [hasSourceTable, hasTaskTable, hasTaskItemTable] = await Promise.all([
    tableExists('crawler_source'),
    tableExists('crawler_task'),
    tableExists('crawler_task_item'),
  ]);
  if (!hasSourceTable) {
    return {
      generatedAt: new Date().toISOString(),
      scheduler: getPublicOpportunityCrawlerSchedulerRuntimeStatus(),
      sources: [],
      summary: {
        blockedSourceCount: 0,
        failedTaskCount: 0,
        healthySourceCount: 0,
        sourceCount: 0,
        warningSourceCount: 0,
        zeroOutputTaskCount: 0,
      },
    };
  }

  const sourceCodes = PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.map(String);
  const placeholders = sourceCodes.map(() => '?').join(', ');
  const sourceRows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        source_id AS sourceId,
        source_code AS sourceCode,
        source_name AS sourceName,
        source_type AS sourceType,
        base_url AS baseUrl,
        enabled,
        robots_url AS robotsUrl,
        rate_limit_per_minute AS rateLimitPerMinute,
        crawl_interval_minutes AS crawlIntervalMinutes,
        allowed_paths_json AS allowedPathsJson,
        blocked_paths_json AS blockedPathsJson,
        keyword_include_json AS keywordIncludeJson,
        keyword_exclude_json AS keywordExcludeJson,
        region_scope_json AS regionScopeJson,
        last_crawled_at AS lastCrawledAt,
        update_time AS updateTime
      FROM crawler_source
      WHERE source_code IN (${placeholders})
      ORDER BY source_code ASC
    `,
    ...sourceCodes,
  );
  const sources = sourceRows.map((row) => mapSource(row));
  if (sources.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      scheduler: getPublicOpportunityCrawlerSchedulerRuntimeStatus(),
      sources: [],
      summary: {
        blockedSourceCount: 0,
        failedTaskCount: 0,
        healthySourceCount: 0,
        sourceCount: 0,
        warningSourceCount: 0,
        zeroOutputTaskCount: 0,
      },
    };
  }

  const sourceIds = sources.map((source) => source.sourceId);
  const idPlaceholders = sourceIds.map(() => '?').join(', ');
  const [taskRows, itemRows, latestTaskRows] = await Promise.all([
    hasTaskTable
      ? prismaClient.$queryRawUnsafe<any[]>(
          `
            SELECT
              source_id AS sourceId,
              SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedTasks,
              SUM(CASE WHEN status = 'SUCCESS' AND fetched_count = 0 AND created_lead_count = 0 AND updated_lead_count = 0 THEN 1 ELSE 0 END) AS zeroOutputTasks
            FROM crawler_task
            WHERE source_id IN (${idPlaceholders})
              AND create_time >= DATE_SUB(NOW(3), INTERVAL 7 DAY)
            GROUP BY source_id
          `,
          ...sourceIds,
        )
      : [],
    hasTaskItemTable
      ? prismaClient.$queryRawUnsafe<any[]>(
          `
            SELECT
              source_id AS sourceId,
              COUNT(*) AS totalItems,
              SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) AS successItems,
              SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedItems,
              SUM(CASE WHEN status IN ('PENDING', 'RUNNING', 'RETRY_WAITING') THEN 1 ELSE 0 END) AS pendingItems
            FROM crawler_task_item
            WHERE source_id IN (${idPlaceholders})
            GROUP BY source_id
          `,
          ...sourceIds,
        )
      : [],
    hasTaskTable
      ? prismaClient.$queryRawUnsafe<any[]>(
          `
            SELECT latest.*
            FROM (
              SELECT
                source_id AS sourceId,
                task_id AS taskId,
                status,
                error_message AS errorMessage,
                ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY create_time DESC, task_id DESC) AS rowNum
              FROM crawler_task
              WHERE source_id IN (${idPlaceholders})
            ) latest
            WHERE latest.rowNum = 1
          `,
          ...sourceIds,
        )
      : [],
  ]);

  const taskStatsBySourceId = new Map<number, any>(
    taskRows.map((row) => [Number(row.sourceId || 0), row]),
  );
  const itemStatsBySourceId = new Map<number, any>(
    itemRows.map((row) => [Number(row.sourceId || 0), row]),
  );
  const latestTaskBySourceId = new Map<number, any>(
    latestTaskRows.map((row) => [Number(row.sourceId || 0), row]),
  );

  const healthSources = sources.map((source) => {
    const taskStats = taskStatsBySourceId.get(source.sourceId) || {};
    const itemStats = itemStatsBySourceId.get(source.sourceId) || {};
    const latestTask = latestTaskBySourceId.get(source.sourceId) || {};
    const totalItems = toNumber(itemStats.totalItems);
    const successItems = toNumber(itemStats.successItems);
    const failedItems = toNumber(itemStats.failedItems);
    const pendingItems = toNumber(itemStats.pendingItems);
    const failedTasks = toNumber(taskStats.failedTasks);
    const zeroOutputTaskCount = toNumber(taskStats.zeroOutputTasks);
    const successRate = toRate(successItems, totalItems);
    const healthStatus = resolveHealthStatus({
      enabled: source.enabled,
      failedItems,
      failedTasks,
      latestError: latestTask.errorMessage,
      pendingItems,
      successRate,
      totalItems,
      zeroOutputTaskCount,
    });
    return {
      failedItems,
      failedTasks,
      healthStatus,
      latestError: latestTask.errorMessage || null,
      latestTaskId: latestTask.taskId ? Number(latestTask.taskId) : null,
      latestTaskStatus: latestTask.status || null,
      pendingItems,
      sourceCode: source.sourceCode,
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      successItems,
      successRate,
      totalItems,
      zeroOutputTaskCount,
    } satisfies PublicCrawlerHealthSourceItem;
  });

  return {
    generatedAt: new Date().toISOString(),
    scheduler: getPublicOpportunityCrawlerSchedulerRuntimeStatus(),
    sources: healthSources,
    summary: {
      blockedSourceCount: healthSources.filter(
        (source) => source.healthStatus === 'BLOCKED',
      ).length,
      failedTaskCount: healthSources.reduce(
        (sum, source) => sum + source.failedTasks,
        0,
      ),
      healthySourceCount: healthSources.filter(
        (source) => source.healthStatus === 'HEALTHY',
      ).length,
      sourceCount: healthSources.length,
      warningSourceCount: healthSources.filter((source) =>
        ['BLOCKED', 'STALE', 'WARNING'].includes(source.healthStatus),
      ).length,
      zeroOutputTaskCount: healthSources.reduce(
        (sum, source) => sum + source.zeroOutputTaskCount,
        0,
      ),
    },
  };
}

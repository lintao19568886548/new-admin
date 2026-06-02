import type {
  CrawlerOpsSummary,
  CrawlerTask,
  CrawlerTaskListParams,
  CrawlerTaskListResult,
  CrawlerTaskLog,
  CrawlerTaskLogLevel,
  CrawlerTaskLogStage,
  CrawlerTaskStatus,
} from './crawler-types';

import { prismaClient } from '~/utils/db';

import {
  checkCrawlerIntervalPolicy,
  checkCrawlerSourcePolicy,
} from './crawler-policy';
import {
  ensureCrawlerSourceCatalog,
  getCrawlerSourceById,
} from './crawler-source-repository';
import {
  countCrawlerTaskItemsByStatus,
  listLatestFailedCrawlerTaskItems,
} from './crawler-task-item-repository';
import { getPublicOpportunityCrawlerSchedulerConfig } from './public-opportunity-crawler-scheduler';

const DEFAULT_STALE_ACTIVE_TASK_MINUTES = 5;

export class CrawlerTaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrawlerTaskValidationError';
  }
}

function parseJsonObject(value: unknown): null | Record<string, unknown> {
  if (!value) {
    return null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stringifyJsonPayload(value: unknown) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item !== 'bigint') {
      return item;
    }
    const numberValue = Number(item);
    return Number.isSafeInteger(numberValue) ? numberValue : item.toString();
  });
}

function mapTaskRow(row: any): CrawlerTask {
  return {
    crawlEndedAt: row.crawlEndedAt || null,
    crawlStartedAt: row.crawlStartedAt || null,
    createTime: row.createTime || null,
    createdLeadCount: Number(row.createdLeadCount || 0),
    errorMessage: row.errorMessage || null,
    failedItemCount: Number(row.failedItemCount || 0),
    fetchedCount: Number(row.fetchedCount || 0),
    finishedAt: row.finishedAt || null,
    maxRetryCount: Number(row.maxRetryCount || 0),
    nextRetryAt: row.nextRetryAt || null,
    pendingItemCount: Number(row.pendingItemCount || 0),
    requestConfigJson: parseJsonObject(row.requestConfigJson),
    retryCount: Number(row.retryCount || 0),
    retryWaitingItemCount: Number(row.retryWaitingItemCount || 0),
    skippedCount: Number(row.skippedCount || 0),
    skippedItemCount: Number(row.skippedItemCount || 0),
    skipReason: row.skipReason || null,
    sourceCode: row.sourceCode || null,
    sourceId: Number(row.sourceId),
    sourceName: row.sourceName || null,
    successItemCount: Number(row.successItemCount || 0),
    startedAt: row.startedAt || null,
    status: row.status || 'PENDING',
    taskId: Number(row.taskId),
    taskType: row.taskType || '',
    updateTime: row.updateTime || null,
    updatedLeadCount: Number(row.updatedLeadCount || 0),
  };
}

function mapLogRow(row: any): CrawlerTaskLog {
  return {
    createTime: row.createTime || null,
    detailJson: parseJsonObject(row.detailJson),
    level: row.level || 'INFO',
    logId: Number(row.logId),
    message: row.message || '',
    stage: row.stage || '',
    taskId: Number(row.taskId),
  };
}

function truncateSkipReason(value: null | string | undefined) {
  if (value === null || value === undefined) {
    return value;
  }
  return String(value).slice(0, 255);
}

function buildTaskSelectSql() {
  return `
    SELECT
      t.task_id AS taskId,
      t.source_id AS sourceId,
      s.source_code AS sourceCode,
      s.source_name AS sourceName,
      t.task_type AS taskType,
      t.status,
      t.started_at AS startedAt,
      t.finished_at AS finishedAt,
      t.crawl_started_at AS crawlStartedAt,
      t.crawl_ended_at AS crawlEndedAt,
      t.fetched_count AS fetchedCount,
      t.created_lead_count AS createdLeadCount,
      t.updated_lead_count AS updatedLeadCount,
      t.skipped_count AS skippedCount,
      t.error_message AS errorMessage,
      t.retry_count AS retryCount,
      t.max_retry_count AS maxRetryCount,
      t.next_retry_at AS nextRetryAt,
      t.skip_reason AS skipReason,
      t.request_config_json AS requestConfigJson,
      t.create_time AS createTime,
      t.update_time AS updateTime,
      COALESCE(item_stats.pending_count, 0) AS pendingItemCount,
      COALESCE(item_stats.retry_waiting_count, 0) AS retryWaitingItemCount,
      COALESCE(item_stats.success_count, 0) AS successItemCount,
      COALESCE(item_stats.failed_count, 0) AS failedItemCount,
      COALESCE(item_stats.skipped_count, 0) AS skippedItemCount
    FROM crawler_task t
    LEFT JOIN crawler_source s ON s.source_id = t.source_id
    LEFT JOIN (
      SELECT
        last_task_id,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status = 'RETRY_WAITING' THEN 1 ELSE 0 END) AS retry_waiting_count,
        SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) AS skipped_count
      FROM crawler_task_item
      WHERE last_task_id IS NOT NULL
      GROUP BY last_task_id
    ) item_stats ON item_stats.last_task_id = t.task_id
  `;
}

export async function listCrawlerTasks(
  params: CrawlerTaskListParams,
): Promise<CrawlerTaskListResult> {
  await ensureCrawlerSourceCatalog();

  const whereClauses = ['1 = 1'];
  const whereParams: unknown[] = [];
  if (params.status) {
    whereClauses.push('t.status = ?');
    whereParams.push(params.status);
  }
  if (params.sourceId && params.sourceId > 0) {
    whereClauses.push('t.source_id = ?');
    whereParams.push(params.sourceId);
  }
  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
  const offset = (params.currentPage - 1) * params.pageSize;

  const [countRows, rows] = await Promise.all([
    prismaClient.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `
        SELECT COUNT(*) AS total
        FROM crawler_task t
        ${whereSql}
      `,
      ...whereParams,
    ),
    prismaClient.$queryRawUnsafe<any[]>(
      `
        ${buildTaskSelectSql()}
        ${whereSql}
        ORDER BY t.create_time DESC, t.task_id DESC
        LIMIT ? OFFSET ?
      `,
      ...whereParams,
      params.pageSize,
      offset,
    ),
  ]);
  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map((row) => mapTaskRow(row)),
    page: {
      currentPage: params.currentPage,
      pageSize: params.pageSize,
      total,
    },
    total,
  };
}

export async function countCrawlerTasksByStatus(sourceId: number) {
  await ensureCrawlerSourceCatalog();
  const rows = await prismaClient.$queryRawUnsafe<
    Array<{ count: bigint | number; status: string }>
  >(
    `
      SELECT status, COUNT(*) AS count
      FROM crawler_task
      WHERE source_id = ?
      GROUP BY status
    `,
    sourceId,
  );
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.status || 'UNKNOWN'] = Number(row.count || 0);
  }
  return result;
}

export async function getCrawlerOpsSummary(sourceId: number) {
  const latestTasks = await listCrawlerTasks({
    currentPage: 1,
    pageSize: 1,
    sourceId,
  });
  const [source, taskStatus, itemStatus, latestFailedItems] = await Promise.all(
    [
      getCrawlerSourceById(sourceId),
      countCrawlerTasksByStatus(sourceId),
      countCrawlerTaskItemsByStatus(sourceId),
      listLatestFailedCrawlerTaskItems({ limit: 5, sourceId }),
    ],
  );

  const schedulerConfig = getPublicOpportunityCrawlerSchedulerConfig();
  const sourcePolicy = source
    ? checkCrawlerSourcePolicy(source)
    : { allowed: false, reason: 'SOURCE_NOT_FOUND' };
  const intervalPolicy =
    source && sourcePolicy.allowed
      ? checkCrawlerIntervalPolicy(source)
      : { allowed: false, reason: sourcePolicy.reason };

  return {
    itemStatus,
    latestFailedItems,
    latestTask: latestTasks.items[0] || null,
    scheduler: {
      ...schedulerConfig,
      canRunNow: Boolean(sourcePolicy.allowed && intervalPolicy.allowed),
      reason: sourcePolicy.reason || intervalPolicy.reason || null,
    },
    source,
    taskStatus,
  } satisfies CrawlerOpsSummary;
}

export async function getCrawlerTaskDetail(taskId: number) {
  await ensureCrawlerSourceCatalog();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      ${buildTaskSelectSql()}
      WHERE t.task_id = ?
      LIMIT 1
    `,
    taskId,
  );
  return rows[0] ? mapTaskRow(rows[0]) : null;
}

export async function listCrawlerTaskLogs(taskId: number) {
  await ensureCrawlerSourceCatalog();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        log_id AS logId,
        task_id AS taskId,
        level,
        stage,
        message,
        detail_json AS detailJson,
        create_time AS createTime
      FROM crawler_task_log
      WHERE task_id = ?
      ORDER BY log_id ASC
    `,
    taskId,
  );
  return {
    items: rows.map((row) => mapLogRow(row)),
    total: rows.length,
  };
}

export async function createCrawlerTask(params: {
  requestConfig?: Record<string, unknown>;
  sourceId: number;
  taskType: string;
}) {
  await ensureCrawlerSourceCatalog();
  await reclaimStaleActiveCrawlerTasks(params.sourceId);

  const activeRows = await prismaClient.$queryRawUnsafe<
    Array<{ taskId: bigint | number }>
  >(
    `
      SELECT task_id AS taskId
      FROM crawler_task
      WHERE source_id = ? AND status IN ('PENDING', 'RUNNING')
      ORDER BY task_id DESC
      LIMIT 1
    `,
    params.sourceId,
  );
  if (activeRows[0]) {
    throw new CrawlerTaskValidationError(
      '同一数据源已有 PENDING/RUNNING 采集任务',
    );
  }

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO crawler_task (
        source_id, task_type, status, request_config_json,
        create_time, update_time
      )
      VALUES (?, ?, 'PENDING', ?, NOW(3), NOW(3))
    `,
    params.sourceId,
    params.taskType,
    params.requestConfig ? stringifyJsonPayload(params.requestConfig) : null,
  );
  const rows = await prismaClient.$queryRawUnsafe<Array<{ taskId: bigint }>>(
    `
      SELECT task_id AS taskId
      FROM crawler_task
      WHERE source_id = ?
      ORDER BY task_id DESC
      LIMIT 1
    `,
    params.sourceId,
  );
  return Number(rows[0]?.taskId || 0);
}

export async function reclaimStaleActiveCrawlerTasks(
  sourceId: number,
  staleMinutes = DEFAULT_STALE_ACTIVE_TASK_MINUTES,
) {
  const normalizedStaleMinutes = Math.max(
    1,
    Math.floor(Number(staleMinutes) || DEFAULT_STALE_ACTIVE_TASK_MINUTES),
  );
  const affected = await prismaClient.$executeRawUnsafe(
    `
      UPDATE crawler_task
      SET status = 'FAILED',
        finished_at = NOW(3),
        crawl_ended_at = COALESCE(crawl_ended_at, NOW(3)),
        error_message = 'STALE_ACTIVE_TASK_RECLAIMED',
        skip_reason = 'STALE_ACTIVE_TASK_RECLAIMED',
        update_time = NOW(3)
      WHERE source_id = ?
        AND status IN ('PENDING', 'RUNNING')
        AND create_time < DATE_SUB(NOW(3), INTERVAL ? MINUTE)
    `,
    sourceId,
    normalizedStaleMinutes,
  );
  return Number(affected || 0);
}

export async function reclaimStaleOrDisabledActiveCrawlerTasks(
  staleMinutes = DEFAULT_STALE_ACTIVE_TASK_MINUTES,
) {
  await ensureCrawlerSourceCatalog();
  const normalizedStaleMinutes = Math.max(
    1,
    Math.floor(Number(staleMinutes) || DEFAULT_STALE_ACTIVE_TASK_MINUTES),
  );
  const affected = await prismaClient.$executeRawUnsafe(
    `
      UPDATE crawler_task t
      INNER JOIN crawler_source s ON s.source_id = t.source_id
      SET t.status = 'FAILED',
        t.finished_at = NOW(3),
        t.crawl_ended_at = COALESCE(t.crawl_ended_at, NOW(3)),
        t.error_message = CASE
          WHEN s.enabled = 0 THEN 'SOURCE_DISABLED_ACTIVE_TASK_RECLAIMED'
          ELSE 'STALE_ACTIVE_TASK_RECLAIMED'
        END,
        t.skip_reason = CASE
          WHEN s.enabled = 0 THEN 'SOURCE_DISABLED_ACTIVE_TASK_RECLAIMED'
          ELSE 'STALE_ACTIVE_TASK_RECLAIMED'
        END,
        t.update_time = NOW(3)
      WHERE t.status IN ('PENDING', 'RUNNING')
        AND (
          s.enabled = 0
          OR t.create_time < DATE_SUB(NOW(3), INTERVAL ? MINUTE)
        )
    `,
    normalizedStaleMinutes,
  );
  return Number(affected || 0);
}

export async function updateCrawlerTaskStatus(params: {
  crawlEndedAt?: Date | null;
  crawlStartedAt?: Date | null;
  createdLeadCount?: number;
  errorMessage?: null | string;
  fetchedCount?: number;
  finishedAt?: Date | null;
  skippedCount?: number;
  skipReason?: null | string;
  startedAt?: Date | null;
  status: CrawlerTaskStatus;
  taskId: number;
  updatedLeadCount?: number;
}) {
  const setClauses = ['status = ?'];
  const setParams: unknown[] = [params.status];
  const push = (sql: string, value: unknown) => {
    setClauses.push(sql);
    setParams.push(value);
  };

  if (params.startedAt !== undefined) {
    push('started_at = ?', params.startedAt);
  }
  if (params.finishedAt !== undefined) {
    push('finished_at = ?', params.finishedAt);
  }
  if (params.crawlStartedAt !== undefined) {
    push('crawl_started_at = ?', params.crawlStartedAt);
  }
  if (params.crawlEndedAt !== undefined) {
    push('crawl_ended_at = ?', params.crawlEndedAt);
  }
  if (params.fetchedCount !== undefined) {
    push('fetched_count = ?', params.fetchedCount);
  }
  if (params.createdLeadCount !== undefined) {
    push('created_lead_count = ?', params.createdLeadCount);
  }
  if (params.updatedLeadCount !== undefined) {
    push('updated_lead_count = ?', params.updatedLeadCount);
  }
  if (params.skippedCount !== undefined) {
    push('skipped_count = ?', params.skippedCount);
  }
  if (params.errorMessage !== undefined) {
    push('error_message = ?', params.errorMessage);
  }
  if (params.skipReason !== undefined) {
    push('skip_reason = ?', truncateSkipReason(params.skipReason));
  }

  await prismaClient.$executeRawUnsafe(
    `
      UPDATE crawler_task
      SET ${setClauses.join(', ')}, update_time = NOW(3)
      WHERE task_id = ?
    `,
    ...setParams,
    params.taskId,
  );
}

export async function appendCrawlerTaskLog(params: {
  detail?: null | Record<string, unknown>;
  level: CrawlerTaskLogLevel;
  message: string;
  stage: CrawlerTaskLogStage;
  taskId: number;
}) {
  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO crawler_task_log (
        task_id, level, stage, message, detail_json, create_time
      )
      VALUES (?, ?, ?, ?, ?, NOW(3))
    `,
    params.taskId,
    params.level,
    params.stage,
    params.message,
    params.detail ? stringifyJsonPayload(params.detail) : null,
  );
}

export async function cancelCrawlerTask(taskId: number) {
  await ensureCrawlerSourceCatalog();
  const task = await getCrawlerTaskDetail(taskId);
  if (!task) {
    return null;
  }
  if (task.status !== 'PENDING') {
    throw new CrawlerTaskValidationError('仅 PENDING 任务允许取消');
  }
  await updateCrawlerTaskStatus({
    finishedAt: new Date(),
    skipReason: 'MANUAL_CANCEL',
    status: 'CANCELED',
    taskId,
  });
  await appendCrawlerTaskLog({
    detail: { status: 'CANCELED' },
    level: 'WARN',
    message: '任务已手动取消',
    stage: 'FINISH',
    taskId,
  });
  return getCrawlerTaskDetail(taskId);
}

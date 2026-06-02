import type {
  CrawlerTaskItem,
  CrawlerTaskItemListParams,
  CrawlerTaskItemListResult,
  CrawlerTaskItemRequeueResult,
} from './crawler-types';

import { createHash } from 'node:crypto';

import { prismaClient } from '../db';
import { ensureCrawlerSourceCatalog } from './crawler-source-repository';

interface QueueSeedInput {
  forcePending?: boolean;
  maxRetryCount: number;
  publishedAt?: null | string;
  sourceId: number;
  sourceRefId?: null | number;
  sourceRefType?: null | string;
  sourceUrl: string;
}

const DEFAULT_STALE_RUNNING_MINUTES = 15;

function buildUrlHash(sourceUrl: string) {
  return createHash('sha256').update(sourceUrl).digest('hex');
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

function toNullableDate(value: unknown) {
  if (!value) {
    return null;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function truncateSkipReason(value: string) {
  return String(value || '').slice(0, 255);
}

function resolveRetryBackoffMinutes(nextRetryCount: number) {
  const schedule = [5, 15, 45];
  const index = Math.max(0, Math.floor(nextRetryCount) - 1);
  return schedule[Math.min(index, schedule.length - 1)];
}

function mapItemRow(row: any): CrawlerTaskItem {
  return {
    createTime: row.createTime || null,
    itemId: Number(row.itemId),
    lastError: row.lastError || null,
    lastFinishedAt: row.lastFinishedAt || null,
    lastHttpStatus:
      row.lastHttpStatus === null || row.lastHttpStatus === undefined
        ? null
        : Number(row.lastHttpStatus),
    lastStartedAt: row.lastStartedAt || null,
    lastSuccessAt: row.lastSuccessAt || null,
    lastTaskId:
      row.lastTaskId === null || row.lastTaskId === undefined
        ? null
        : Number(row.lastTaskId),
    maxRetryCount: Number(row.maxRetryCount || 0),
    nextRetryAt: row.nextRetryAt || null,
    publishedAt: row.publishedAt || null,
    retryCount: Number(row.retryCount || 0),
    skipReason: row.skipReason || null,
    sourceId: Number(row.sourceId),
    sourceRefId:
      row.sourceRefId === null || row.sourceRefId === undefined
        ? null
        : Number(row.sourceRefId),
    sourceRefType: row.sourceRefType || null,
    sourceUrl: row.sourceUrl || '',
    status: row.status || 'PENDING',
    updateTime: row.updateTime || null,
  };
}

export async function seedCrawlerTaskItems(inputs: QueueSeedInput[]) {
  await ensureCrawlerSourceCatalog();
  let createdCount = 0;
  let updatedCount = 0;

  for (const input of inputs) {
    const sourceUrl = String(input.sourceUrl || '').trim();
    if (!sourceUrl) {
      continue;
    }
    const urlHash = buildUrlHash(sourceUrl);
    const existing = await prismaClient.$queryRawUnsafe<
      Array<{ itemId: bigint }>
    >(
      `
        SELECT item_id AS itemId
        FROM crawler_task_item
        WHERE source_id = ? AND url_hash = ?
        LIMIT 1
      `,
      input.sourceId,
      urlHash,
    );

    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO crawler_task_item (
          source_id, source_ref_type, source_ref_id, source_url, url_hash,
          status, max_retry_count, published_at, create_time, update_time
        )
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          source_ref_type = VALUES(source_ref_type),
          source_ref_id = VALUES(source_ref_id),
          source_url = VALUES(source_url),
          max_retry_count = VALUES(max_retry_count),
          published_at = COALESCE(VALUES(published_at), published_at),
          retry_count = CASE
            WHEN ? = 1 AND status IN ('FAILED', 'RETRY_WAITING', 'SKIPPED') THEN 0
            ELSE retry_count
          END,
          next_retry_at = CASE
            WHEN ? = 1 AND status IN ('FAILED', 'RETRY_WAITING', 'SKIPPED') THEN NULL
            ELSE next_retry_at
          END,
          last_error = CASE
            WHEN ? = 1 AND status IN ('FAILED', 'RETRY_WAITING', 'SKIPPED') THEN NULL
            ELSE last_error
          END,
          skip_reason = CASE
            WHEN ? = 1 AND status IN ('FAILED', 'RETRY_WAITING', 'SKIPPED') THEN NULL
            ELSE skip_reason
          END,
          status = CASE
            WHEN ? = 1 AND status IN ('FAILED', 'RETRY_WAITING', 'SKIPPED') THEN 'PENDING'
            ELSE status
          END,
          update_time = NOW(3)
      `,
      input.sourceId,
      input.sourceRefType || null,
      input.sourceRefId || null,
      sourceUrl,
      urlHash,
      input.maxRetryCount,
      toNullableDate(input.publishedAt),
      input.forcePending ? 1 : 0,
      input.forcePending ? 1 : 0,
      input.forcePending ? 1 : 0,
      input.forcePending ? 1 : 0,
      input.forcePending ? 1 : 0,
    );

    if (existing[0]) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
  }

  return { createdCount, updatedCount };
}

export async function listRunnableCrawlerTaskItems(params: {
  allowUnknownPublishedAt?: boolean;
  freshAfter?: Date;
  limit: number;
  prioritySourceRefIds?: number[];
  reprocessSuccess?: boolean;
  sourceId: number;
  staleReprocessAfter?: Date;
}) {
  await ensureCrawlerSourceCatalog();
  const priorityIds = (params.prioritySourceRefIds || [])
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);
  const queryParams = [
    params.sourceId,
    params.reprocessSuccess ? 1 : 0,
    params.staleReprocessAfter || null,
    params.staleReprocessAfter || null,
    params.freshAfter || null,
    params.freshAfter || null,
    params.allowUnknownPublishedAt ? 1 : 0,
    ...priorityIds,
    params.limit,
  ];
  const priorityOrderSql =
    priorityIds.length > 0
      ? `CASE WHEN source_ref_id IN (${priorityIds
          .map(() => '?')
          .join(', ')}) THEN 0 ELSE 1 END,`
      : '';
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        item_id AS itemId,
        source_id AS sourceId,
        last_task_id AS lastTaskId,
        source_ref_type AS sourceRefType,
        source_ref_id AS sourceRefId,
        source_url AS sourceUrl,
        status,
        retry_count AS retryCount,
        max_retry_count AS maxRetryCount,
        next_retry_at AS nextRetryAt,
        last_http_status AS lastHttpStatus,
        last_error AS lastError,
        skip_reason AS skipReason,
        published_at AS publishedAt,
        last_started_at AS lastStartedAt,
        last_finished_at AS lastFinishedAt,
        last_success_at AS lastSuccessAt,
        create_time AS createTime,
        update_time AS updateTime
      FROM crawler_task_item
      WHERE source_id = ?
        AND (
          status = 'PENDING'
          OR (status = 'RETRY_WAITING' AND (next_retry_at IS NULL OR next_retry_at <= NOW(3)))
          OR (? = 1 AND status = 'SUCCESS')
          OR (
            ? IS NOT NULL
            AND status = 'SUCCESS'
            AND (last_finished_at IS NULL OR last_finished_at <= ?)
          )
        )
        AND retry_count < max_retry_count
        AND (? IS NULL OR published_at >= ? OR (? = 1 AND published_at IS NULL))
        ORDER BY
        ${priorityOrderSql}
        CASE
          WHEN status = 'PENDING' THEN 0
          WHEN status = 'RETRY_WAITING' THEN 1
          ELSE 2
        END,
        COALESCE(last_finished_at, create_time) ASC,
        CASE WHEN published_at IS NULL THEN 1 ELSE 0 END,
        published_at DESC,
        item_id ASC
      LIMIT ?
    `,
    ...queryParams,
  );
  return rows.map((row) => mapItemRow(row));
}

export async function countCrawlerTaskItemsByStatus(sourceId: number) {
  await ensureCrawlerSourceCatalog();
  const rows = await prismaClient.$queryRawUnsafe<
    Array<{ count: bigint | number; status: string }>
  >(
    `
      SELECT status, COUNT(*) AS count
      FROM crawler_task_item
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

export async function listLatestFailedCrawlerTaskItems(params: {
  limit: number;
  sourceId: number;
}) {
  await ensureCrawlerSourceCatalog();
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        item_id AS itemId,
        source_id AS sourceId,
        last_task_id AS lastTaskId,
        source_ref_type AS sourceRefType,
        source_ref_id AS sourceRefId,
        source_url AS sourceUrl,
        status,
        retry_count AS retryCount,
        max_retry_count AS maxRetryCount,
        next_retry_at AS nextRetryAt,
        last_http_status AS lastHttpStatus,
        last_error AS lastError,
        skip_reason AS skipReason,
        published_at AS publishedAt,
        last_started_at AS lastStartedAt,
        last_finished_at AS lastFinishedAt,
        last_success_at AS lastSuccessAt,
        create_time AS createTime,
        update_time AS updateTime
      FROM crawler_task_item
      WHERE source_id = ?
        AND status IN ('FAILED', 'RETRY_WAITING')
      ORDER BY update_time DESC, item_id DESC
      LIMIT ?
    `,
    params.sourceId,
    Math.max(1, Math.min(20, params.limit)),
  );
  return rows.map((row) => mapItemRow(row));
}

export async function requeueCrawlerTaskItems(params: {
  itemIds?: number[];
  sourceId: number;
  statuses?: string[];
}): Promise<CrawlerTaskItemRequeueResult> {
  await ensureCrawlerSourceCatalog();
  const itemIds = (params.itemIds || [])
    .map(Number)
    .filter((itemId) => Number.isFinite(itemId) && itemId > 0);
  const statuses =
    params.statuses && params.statuses.length > 0
      ? params.statuses
      : ['FAILED', 'RETRY_WAITING', 'SKIPPED'];
  const allowedStatuses = statuses
    .map((status) =>
      String(status || '')
        .trim()
        .toUpperCase(),
    )
    .filter((status) =>
      ['FAILED', 'RETRY_WAITING', 'SKIPPED'].includes(status),
    );
  if (allowedStatuses.length === 0) {
    return {
      requeuedCount: 0,
      sourceId: params.sourceId,
      status: 'PENDING',
    };
  }

  const whereClauses = [
    'source_id = ?',
    `status IN (${allowedStatuses.map(() => '?').join(', ')})`,
  ];
  const whereParams: unknown[] = [params.sourceId, ...allowedStatuses];
  if (itemIds.length > 0) {
    whereClauses.push(`item_id IN (${itemIds.map(() => '?').join(', ')})`);
    whereParams.push(...itemIds);
  }

  const affected = await prismaClient.$executeRawUnsafe(
    `
      UPDATE crawler_task_item
      SET status = 'PENDING',
        retry_count = 0,
        next_retry_at = NULL,
        last_error = NULL,
        skip_reason = NULL,
        update_time = NOW(3)
      WHERE ${whereClauses.join(' AND ')}
    `,
    ...whereParams,
  );

  return {
    requeuedCount: Number(affected || 0),
    sourceId: params.sourceId,
    status: 'PENDING',
  };
}

export async function reclaimStaleRunningCrawlerTaskItems(params: {
  sourceId: number;
  staleMinutes?: number;
  taskId?: number;
}) {
  await ensureCrawlerSourceCatalog();
  const staleMinutes = Math.max(
    1,
    Math.floor(Number(params.staleMinutes) || DEFAULT_STALE_RUNNING_MINUTES),
  );
  const affected = await prismaClient.$executeRawUnsafe(
    `
      UPDATE crawler_task_item
      SET retry_count = retry_count + 1,
        status = CASE
          WHEN retry_count + 1 >= max_retry_count THEN 'FAILED'
          ELSE 'RETRY_WAITING'
        END,
        next_retry_at = CASE
          WHEN retry_count + 1 >= max_retry_count THEN NULL
          ELSE NOW(3)
        END,
        last_finished_at = NOW(3),
        last_error = 'STALE_RUNNING_RECLAIMED',
        update_time = NOW(3)
      WHERE source_id = ?
        AND status = 'RUNNING'
        AND last_started_at IS NOT NULL
        AND last_started_at < DATE_SUB(NOW(3), INTERVAL ? MINUTE)
    `,
    params.sourceId,
    staleMinutes,
  );
  return {
    reclaimedCount: Number(affected || 0),
    staleMinutes,
  };
}

export async function claimCrawlerTaskItem(params: {
  itemId: number;
  reprocessSuccess?: boolean;
  staleReprocessAfter?: Date;
  taskId: number;
}) {
  const affected = await prismaClient.$executeRawUnsafe(
    `
      UPDATE crawler_task_item
      SET status = 'RUNNING',
        last_task_id = ?,
        last_started_at = NOW(3),
        last_error = NULL,
        skip_reason = NULL,
        update_time = NOW(3)
      WHERE item_id = ?
        AND (
          status = 'PENDING'
          OR (status = 'RETRY_WAITING' AND (next_retry_at IS NULL OR next_retry_at <= NOW(3)))
          OR (? = 1 AND status = 'SUCCESS')
          OR (
            ? IS NOT NULL
            AND status = 'SUCCESS'
            AND (last_finished_at IS NULL OR last_finished_at <= ?)
          )
        )
        AND retry_count < max_retry_count
    `,
    params.taskId,
    params.itemId,
    params.reprocessSuccess ? 1 : 0,
    params.staleReprocessAfter || null,
    params.staleReprocessAfter || null,
  );
  return Number(affected || 0) > 0;
}

export const markCrawlerTaskItemRunning = claimCrawlerTaskItem;

export async function markCrawlerTaskItemSuccess(params: {
  httpStatus?: null | number;
  itemId: number;
  parsedPayload?: null | Record<string, unknown>;
  publishedAt?: null | string;
  responseText?: null | string;
  taskId: number;
}) {
  const responseHash = params.responseText
    ? createHash('sha256').update(params.responseText).digest('hex')
    : null;
  await prismaClient.$executeRawUnsafe(
    `
      UPDATE crawler_task_item
      SET status = 'SUCCESS',
        last_task_id = ?,
        last_http_status = ?,
        last_finished_at = NOW(3),
        last_success_at = NOW(3),
        response_hash = ?,
        parsed_payload_json = ?,
        published_at = COALESCE(?, published_at),
        last_error = NULL,
        skip_reason = NULL,
        update_time = NOW(3)
      WHERE item_id = ?
    `,
    params.taskId,
    params.httpStatus || null,
    responseHash,
    params.parsedPayload ? stringifyJsonPayload(params.parsedPayload) : null,
    toNullableDate(params.publishedAt),
    params.itemId,
  );
}

export async function markCrawlerTaskItemSkipped(params: {
  itemId: number;
  parsedPayload?: null | Record<string, unknown>;
  publishedAt?: null | string;
  reason: string;
  taskId: number;
}) {
  await prismaClient.$executeRawUnsafe(
    `
      UPDATE crawler_task_item
      SET status = 'SKIPPED',
        last_task_id = ?,
        last_finished_at = NOW(3),
        skip_reason = ?,
        parsed_payload_json = ?,
        published_at = COALESCE(?, published_at),
        update_time = NOW(3)
      WHERE item_id = ?
    `,
    params.taskId,
    truncateSkipReason(params.reason),
    params.parsedPayload ? stringifyJsonPayload(params.parsedPayload) : null,
    toNullableDate(params.publishedAt),
    params.itemId,
  );
}

export async function markCrawlerTaskItemFailed(params: {
  httpStatus?: null | number;
  itemId: number;
  maxRetryCount: number;
  message: string;
  retryDelayMinutes: number;
  taskId: number;
}) {
  const rows = await prismaClient.$queryRawUnsafe<
    Array<{ retryCount: number }>
  >(
    `
      SELECT retry_count AS retryCount
      FROM crawler_task_item
      WHERE item_id = ?
      LIMIT 1
    `,
    params.itemId,
  );
  const nextRetryCount = Number(rows[0]?.retryCount || 0) + 1;
  const finalStatus =
    nextRetryCount >= params.maxRetryCount ? 'FAILED' : 'RETRY_WAITING';
  const retryBackoffMinutes = resolveRetryBackoffMinutes(nextRetryCount);

  await prismaClient.$executeRawUnsafe(
    `
      UPDATE crawler_task_item
      SET status = ?,
        last_task_id = ?,
        retry_count = ?,
        max_retry_count = ?,
        next_retry_at = CASE
          WHEN ? = 'FAILED' THEN NULL
          ELSE DATE_ADD(NOW(3), INTERVAL ? MINUTE)
        END,
        last_http_status = ?,
        last_error = ?,
        last_finished_at = NOW(3),
        update_time = NOW(3)
      WHERE item_id = ?
    `,
    finalStatus,
    params.taskId,
    nextRetryCount,
    params.maxRetryCount,
    finalStatus,
    retryBackoffMinutes,
    params.httpStatus || null,
    params.message,
    params.itemId,
  );

  return { finalStatus, retryCount: nextRetryCount };
}

export async function listCrawlerTaskItems(
  params: CrawlerTaskItemListParams,
): Promise<CrawlerTaskItemListResult> {
  await ensureCrawlerSourceCatalog();
  const whereClauses = ['1 = 1'];
  const whereParams: unknown[] = [];
  if (params.sourceId && params.sourceId > 0) {
    whereClauses.push('source_id = ?');
    whereParams.push(params.sourceId);
  }
  if (params.taskId && params.taskId > 0) {
    whereClauses.push('last_task_id = ?');
    whereParams.push(params.taskId);
  }
  if (params.status) {
    whereClauses.push('status = ?');
    whereParams.push(params.status);
  }
  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
  const offset = (params.currentPage - 1) * params.pageSize;
  const [countRows, rows] = await Promise.all([
    prismaClient.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `
        SELECT COUNT(*) AS total
        FROM crawler_task_item
        ${whereSql}
      `,
      ...whereParams,
    ),
    prismaClient.$queryRawUnsafe<any[]>(
      `
        SELECT
          item_id AS itemId,
          source_id AS sourceId,
          last_task_id AS lastTaskId,
          source_ref_type AS sourceRefType,
          source_ref_id AS sourceRefId,
          source_url AS sourceUrl,
          status,
          retry_count AS retryCount,
          max_retry_count AS maxRetryCount,
          next_retry_at AS nextRetryAt,
          last_http_status AS lastHttpStatus,
          last_error AS lastError,
          skip_reason AS skipReason,
          published_at AS publishedAt,
          last_started_at AS lastStartedAt,
          last_finished_at AS lastFinishedAt,
          last_success_at AS lastSuccessAt,
          create_time AS createTime,
          update_time AS updateTime
        FROM crawler_task_item
        ${whereSql}
        ORDER BY update_time DESC, item_id DESC
        LIMIT ? OFFSET ?
      `,
      ...whereParams,
      params.pageSize,
      offset,
    ),
  ]);
  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map((row) => mapItemRow(row)),
    page: {
      currentPage: params.currentPage,
      pageSize: params.pageSize,
      total,
    },
    total,
  };
}

export function getParsedPayload(value: unknown) {
  return parseJsonObject(value);
}

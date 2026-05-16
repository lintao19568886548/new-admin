import type {
  CrawlerSource,
  CrawlerSourceListResult,
  CrawlerSourceUpdatePayload,
} from './crawler-types';

import { prismaClient } from '~/utils/db';

import {
  isPublicFactoryCfzsw68AllowedPathPolicy,
  isPublicOpportunity99CfwAllowedPathPolicy,
  PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN,
  PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS,
  PUBLIC_OPPORTUNITY_99CFW_ALLOWED_ORIGIN,
  PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS,
} from './crawler-policy';
import {
  DEMO_CRAWLER_SOURCE_CODE,
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
} from './crawler-types';

export class CrawlerSourceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrawlerSourceValidationError';
  }
}

const jsonArrayFieldNames = [
  'allowedPathsJson',
  'blockedPathsJson',
  'keywordIncludeJson',
  'keywordExcludeJson',
  'regionScopeJson',
] as const;

type JsonArrayFieldName = (typeof jsonArrayFieldNames)[number];

function parseJsonArray(value: unknown): null | string[] {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    if (value.some((item) => typeof item !== 'string')) {
      throw new CrawlerSourceValidationError(
        'JSON policy fields only accept string arrays',
      );
    }
    return value.map((item) => item.trim()).filter(Boolean);
  }
  throw new CrawlerSourceValidationError(
    'JSON policy fields only accept string arrays or null',
  );
}

function parseStoredJsonArray(value: unknown): null | string[] {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

function toJson(value: null | string[] | undefined) {
  return value && value.length > 0 ? JSON.stringify(value) : null;
}

function toNullableString(value: unknown) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}

function mapSourceRow(row: any): CrawlerSource {
  const sourceCode = row.sourceCode || '';
  const storedAllowedPaths = parseStoredJsonArray(row.allowedPathsJson);
  let allowedPathsJson = storedAllowedPaths;
  if (sourceCode === PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE) {
    allowedPathsJson = [...PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS];
  } else if (sourceCode === PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE) {
    allowedPathsJson = [...PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS];
  }

  return {
    allowedPathsJson,
    baseUrl: row.baseUrl || '',
    blockedPathsJson: parseStoredJsonArray(row.blockedPathsJson),
    crawlIntervalMinutes: Number(row.crawlIntervalMinutes || 0),
    createTime: row.createTime || null,
    enabled: Boolean(Number(row.enabled)),
    keywordExcludeJson: parseStoredJsonArray(row.keywordExcludeJson),
    keywordIncludeJson: parseStoredJsonArray(row.keywordIncludeJson),
    lastCrawledAt: row.lastCrawledAt || null,
    rateLimitPerMinute: Number(row.rateLimitPerMinute || 0),
    regionScopeJson: parseStoredJsonArray(row.regionScopeJson),
    robotsUrl: row.robotsUrl || null,
    sourceCode,
    sourceId: Number(row.sourceId),
    sourceName: row.sourceName || '',
    sourceType: row.sourceType || 'DEMO',
    updateTime: row.updateTime || null,
  };
}

async function ensureColumnExists(params: {
  columnDefinition: string;
  columnName: string;
  tableName: string;
}) {
  const rows = await prismaClient.$queryRawUnsafe<Array<{ total: bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    params.tableName,
    params.columnName,
  );
  if (Number(rows[0]?.total || 0) > 0) {
    return;
  }
  await prismaClient.$executeRawUnsafe(
    `ALTER TABLE ${params.tableName} ADD COLUMN ${params.columnDefinition}`,
  );
}

export async function ensureCrawlerStorage() {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS crawler_source (
      source_id bigint NOT NULL AUTO_INCREMENT,
      source_code varchar(100) NOT NULL,
      source_name varchar(100) NOT NULL,
      source_type varchar(50) NOT NULL,
      base_url varchar(500) NOT NULL,
      robots_url varchar(500) NULL DEFAULT NULL,
      enabled tinyint(1) NOT NULL DEFAULT 1,
      crawl_interval_minutes int NOT NULL DEFAULT 1440,
      rate_limit_per_minute int NOT NULL DEFAULT 30,
      allowed_paths_json text NULL,
      blocked_paths_json text NULL,
      keyword_include_json text NULL,
      keyword_exclude_json text NULL,
      region_scope_json text NULL,
      last_crawled_at datetime(3) NULL DEFAULT NULL,
      create_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (source_id),
      UNIQUE KEY crawler_source_source_code_uq (source_code),
      KEY crawler_source_enabled_idx (enabled),
      KEY crawler_source_source_type_idx (source_type)
    ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS crawler_task (
      task_id bigint NOT NULL AUTO_INCREMENT,
      source_id bigint NOT NULL,
      task_type varchar(50) NOT NULL,
      status varchar(30) NOT NULL DEFAULT 'PENDING',
      started_at datetime(3) NULL DEFAULT NULL,
      finished_at datetime(3) NULL DEFAULT NULL,
      crawl_started_at datetime(3) NULL DEFAULT NULL,
      crawl_ended_at datetime(3) NULL DEFAULT NULL,
      fetched_count int NOT NULL DEFAULT 0,
      created_lead_count int NOT NULL DEFAULT 0,
      updated_lead_count int NOT NULL DEFAULT 0,
      skipped_count int NOT NULL DEFAULT 0,
      error_message text NULL,
      retry_count int NOT NULL DEFAULT 0,
      max_retry_count int NOT NULL DEFAULT 0,
      next_retry_at datetime(3) NULL DEFAULT NULL,
      skip_reason varchar(255) NULL DEFAULT NULL,
      request_config_json text NULL,
      create_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (task_id),
      KEY crawler_task_source_id_idx (source_id),
      KEY crawler_task_status_idx (status),
      KEY crawler_task_create_time_idx (create_time)
    ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS crawler_task_log (
      log_id bigint NOT NULL AUTO_INCREMENT,
      task_id bigint NOT NULL,
      level varchar(20) NOT NULL,
      stage varchar(50) NOT NULL,
      message varchar(500) NOT NULL,
      detail_json text NULL,
      create_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (log_id),
      KEY crawler_task_log_task_id_idx (task_id),
      KEY crawler_task_log_stage_idx (stage)
    ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS crawler_task_item (
      item_id bigint NOT NULL AUTO_INCREMENT,
      source_id bigint NOT NULL,
      last_task_id bigint NULL DEFAULT NULL,
      source_ref_type varchar(50) NULL DEFAULT NULL,
      source_ref_id bigint NULL DEFAULT NULL,
      source_url varchar(800) NOT NULL,
      url_hash varchar(80) NOT NULL,
      status varchar(30) NOT NULL DEFAULT 'PENDING',
      retry_count int NOT NULL DEFAULT 0,
      max_retry_count int NOT NULL DEFAULT 3,
      next_retry_at datetime(3) NULL DEFAULT NULL,
      last_http_status int NULL DEFAULT NULL,
      last_error text NULL,
      skip_reason varchar(255) NULL DEFAULT NULL,
      published_at datetime(3) NULL DEFAULT NULL,
      last_started_at datetime(3) NULL DEFAULT NULL,
      last_finished_at datetime(3) NULL DEFAULT NULL,
      last_success_at datetime(3) NULL DEFAULT NULL,
      response_hash varchar(80) NULL DEFAULT NULL,
      parsed_payload_json text NULL,
      create_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (item_id),
      UNIQUE KEY crawler_task_item_source_url_uq (source_id, url_hash),
      KEY crawler_task_item_last_task_id_idx (last_task_id),
      KEY crawler_task_item_source_status_idx (source_id, status),
      KEY crawler_task_item_next_retry_idx (next_retry_at),
      KEY crawler_task_item_source_ref_idx (source_ref_type, source_ref_id)
    ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  `);

  await ensureColumnExists({
    columnDefinition:
      'update_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)',
    columnName: 'update_time',
    tableName: 'crawler_task',
  });
}

export async function ensureDemoCrawlerSource() {
  await ensureCrawlerStorage();

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO crawler_source (
        source_code, source_name, source_type, base_url, robots_url, enabled,
        crawl_interval_minutes, rate_limit_per_minute,
        allowed_paths_json, blocked_paths_json,
        keyword_include_json, keyword_exclude_json, region_scope_json,
        create_time, update_time
      )
      VALUES (?, 'External lead demo source', 'DEMO', 'demo://public', NULL, 1,
        0, 60, ?, ?, ?, NULL, ?, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        source_name = VALUES(source_name),
        source_type = VALUES(source_type),
        base_url = VALUES(base_url),
        update_time = update_time
    `,
    DEMO_CRAWLER_SOURCE_CODE,
    JSON.stringify(['/public']),
    JSON.stringify(['/blocked']),
    JSON.stringify(['扩建', '扩产', '新增产线', '搬迁', '技改', '仓储']),
    JSON.stringify(['惠州', '东莞', '广州']),
  );

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO crawler_source (
        source_code, source_name, source_type, base_url, robots_url, enabled,
        crawl_interval_minutes, rate_limit_per_minute,
        allowed_paths_json, blocked_paths_json,
        keyword_include_json, keyword_exclude_json, region_scope_json,
        create_time, update_time
      )
      VALUES (?, '99cfw public opportunity URL pilot', 'PUBLIC_OPPORTUNITY',
        ?, NULL, 1,
        5, 10, ?, ?, ?, ?, NULL, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        source_name = VALUES(source_name),
        source_type = VALUES(source_type),
        base_url = VALUES(base_url),
        robots_url = VALUES(robots_url),
        allowed_paths_json = VALUES(allowed_paths_json),
        update_time = update_time
    `,
    PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
    PUBLIC_OPPORTUNITY_99CFW_ALLOWED_ORIGIN,
    JSON.stringify(PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS),
    JSON.stringify([]),
    JSON.stringify([
      '扩产',
      '搬迁',
      '迁建',
      '新建厂房',
      '技改',
      '生产线',
      '仓储',
      '求租',
      '租厂房',
      '厂房需求',
      '产业园',
      '项目落地',
      '招商引资',
    ]),
    JSON.stringify([
      '住宅',
      '商铺',
      '个人',
      '培训',
      '会议',
      '活动宣传',
      '招聘普通岗位',
    ]),
  );

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO crawler_source (
        source_code, source_name, source_type, base_url, robots_url, enabled,
        crawl_interval_minutes, rate_limit_per_minute,
        allowed_paths_json, blocked_paths_json,
        keyword_include_json, keyword_exclude_json, region_scope_json,
        create_time, update_time
      )
      VALUES (?, 'cfzsw68 public factory listing URL pilot', 'PUBLIC_OPPORTUNITY',
        ?, NULL, 1,
        5, 10, ?, ?, ?, ?, ?, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        source_name = VALUES(source_name),
        source_type = VALUES(source_type),
        base_url = VALUES(base_url),
        robots_url = VALUES(robots_url),
        allowed_paths_json = VALUES(allowed_paths_json),
        update_time = update_time
    `,
    PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
    PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN,
    JSON.stringify(PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS),
    JSON.stringify([]),
    JSON.stringify(['厂房', '出租', '招租', '分租', '平方', '平米']),
    JSON.stringify(['求租', '出售', '写字楼', '住宅', '商铺']),
    JSON.stringify(['深圳']),
  );
}

export async function listCrawlerSources(): Promise<CrawlerSourceListResult> {
  await ensureDemoCrawlerSource();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        source_id AS sourceId,
        source_code AS sourceCode,
        source_name AS sourceName,
        source_type AS sourceType,
        base_url AS baseUrl,
        robots_url AS robotsUrl,
        enabled,
        crawl_interval_minutes AS crawlIntervalMinutes,
        rate_limit_per_minute AS rateLimitPerMinute,
        allowed_paths_json AS allowedPathsJson,
        blocked_paths_json AS blockedPathsJson,
        keyword_include_json AS keywordIncludeJson,
        keyword_exclude_json AS keywordExcludeJson,
        region_scope_json AS regionScopeJson,
        last_crawled_at AS lastCrawledAt,
        create_time AS createTime,
        update_time AS updateTime
      FROM crawler_source
      ORDER BY source_id ASC
    `,
  );

  return {
    items: rows.map((row) => mapSourceRow(row)),
    total: rows.length,
  };
}

export async function getCrawlerSourceById(
  sourceId: number,
): Promise<CrawlerSource | null> {
  await ensureDemoCrawlerSource();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        source_id AS sourceId,
        source_code AS sourceCode,
        source_name AS sourceName,
        source_type AS sourceType,
        base_url AS baseUrl,
        robots_url AS robotsUrl,
        enabled,
        crawl_interval_minutes AS crawlIntervalMinutes,
        rate_limit_per_minute AS rateLimitPerMinute,
        allowed_paths_json AS allowedPathsJson,
        blocked_paths_json AS blockedPathsJson,
        keyword_include_json AS keywordIncludeJson,
        keyword_exclude_json AS keywordExcludeJson,
        region_scope_json AS regionScopeJson,
        last_crawled_at AS lastCrawledAt,
        create_time AS createTime,
        update_time AS updateTime
      FROM crawler_source
      WHERE source_id = ?
      LIMIT 1
    `,
    sourceId,
  );
  return rows[0] ? mapSourceRow(rows[0]) : null;
}

async function getCrawlerSourceByCode(sourceCode: string) {
  await ensureDemoCrawlerSource();
  const rows = await prismaClient.$queryRawUnsafe<Array<{ sourceId: bigint }>>(
    `
      SELECT source_id AS sourceId
      FROM crawler_source
      WHERE source_code = ?
      LIMIT 1
    `,
    sourceCode,
  );
  const sourceId = rows[0] ? Number(rows[0].sourceId) : 0;
  return sourceId > 0 ? getCrawlerSourceById(sourceId) : null;
}

export function getPublicCrawlerSourceByCode(sourceCode: string) {
  return getCrawlerSourceByCode(sourceCode);
}

export function getDemoCrawlerSource() {
  return getCrawlerSourceByCode(DEMO_CRAWLER_SOURCE_CODE);
}

export function getPublicOpportunityCrawlerSource() {
  return getCrawlerSourceByCode(PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE);
}

export function getPublicFactoryListingCrawlerSource() {
  return getCrawlerSourceByCode(PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE);
}

export async function listPublicOpportunityCrawlerSources() {
  const sources = await Promise.all([
    getPublicOpportunityCrawlerSource(),
    getPublicFactoryListingCrawlerSource(),
  ]);
  return sources.filter(Boolean) as CrawlerSource[];
}

function normalizeUpdatePayload(payload: CrawlerSourceUpdatePayload) {
  const normalized: CrawlerSourceUpdatePayload = {};

  if (payload.enabled !== undefined) {
    normalized.enabled = Boolean(payload.enabled);
  }
  if (payload.crawlIntervalMinutes !== undefined) {
    const value = Number(payload.crawlIntervalMinutes);
    if (!Number.isFinite(value) || value < 0) {
      throw new CrawlerSourceValidationError('crawlIntervalMinutes is invalid');
    }
    normalized.crawlIntervalMinutes = Math.floor(value);
  }
  if (payload.rateLimitPerMinute !== undefined) {
    const value = Number(payload.rateLimitPerMinute);
    if (!Number.isFinite(value) || value <= 0) {
      throw new CrawlerSourceValidationError('rateLimitPerMinute is invalid');
    }
    normalized.rateLimitPerMinute = Math.floor(value);
  }
  if (payload.robotsUrl !== undefined) {
    normalized.robotsUrl = toNullableString(payload.robotsUrl) as null | string;
  }
  for (const field of jsonArrayFieldNames) {
    if (payload[field] !== undefined) {
      normalized[field] = parseJsonArray(payload[field]) as any;
    }
  }

  return normalized;
}

export async function updateCrawlerSource(
  sourceId: number,
  payload: CrawlerSourceUpdatePayload,
) {
  const source = await getCrawlerSourceById(sourceId);
  if (!source) {
    return null;
  }

  const normalized = normalizeUpdatePayload(payload);
  if (source.sourceCode === PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE) {
    if (
      normalized.allowedPathsJson !== undefined &&
      !isPublicOpportunity99CfwAllowedPathPolicy(normalized.allowedPathsJson)
    ) {
      throw new CrawlerSourceValidationError(
        '99cfw pilot only allows /changfangxuqiu/ path policy',
      );
    }
    normalized.allowedPathsJson = [...PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS];
    normalized.robotsUrl = null;
  } else if (source.sourceCode === PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE) {
    if (
      normalized.allowedPathsJson !== undefined &&
      !isPublicFactoryCfzsw68AllowedPathPolicy(normalized.allowedPathsJson)
    ) {
      throw new CrawlerSourceValidationError(
        'cfzsw68 pilot only allows /sz/cfcz/ path policy',
      );
    }
    normalized.allowedPathsJson = [...PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS];
    normalized.robotsUrl = null;
  } else if (normalized.robotsUrl === null && source.sourceType !== 'DEMO') {
    throw new CrawlerSourceValidationError(
      'robotsUrl can only be empty for DEMO sources',
    );
  }

  const setClauses: string[] = [];
  const setParams: unknown[] = [];
  const pushSet = (sql: string, value: unknown) => {
    setClauses.push(sql);
    setParams.push(value);
  };

  if (normalized.enabled !== undefined) {
    pushSet('enabled = ?', normalized.enabled ? 1 : 0);
  }
  if (normalized.crawlIntervalMinutes !== undefined) {
    pushSet('crawl_interval_minutes = ?', normalized.crawlIntervalMinutes);
  }
  if (normalized.rateLimitPerMinute !== undefined) {
    pushSet('rate_limit_per_minute = ?', normalized.rateLimitPerMinute);
  }
  if (normalized.robotsUrl !== undefined) {
    pushSet('robots_url = ?', normalized.robotsUrl);
  }
  const columnByField: Record<JsonArrayFieldName, string> = {
    allowedPathsJson: 'allowed_paths_json',
    blockedPathsJson: 'blocked_paths_json',
    keywordExcludeJson: 'keyword_exclude_json',
    keywordIncludeJson: 'keyword_include_json',
    regionScopeJson: 'region_scope_json',
  };
  for (const field of jsonArrayFieldNames) {
    if (normalized[field] !== undefined) {
      pushSet(`${columnByField[field]} = ?`, toJson(normalized[field]));
    }
  }

  if (setClauses.length === 0) {
    return source;
  }

  await prismaClient.$executeRawUnsafe(
    `
      UPDATE crawler_source
      SET ${setClauses.join(', ')}, update_time = NOW(3)
      WHERE source_id = ?
    `,
    ...setParams,
    sourceId,
  );

  return getCrawlerSourceById(sourceId);
}

export async function setCrawlerSourceEnabled(
  sourceId: number,
  enabled: boolean,
) {
  return updateCrawlerSource(sourceId, { enabled });
}

export async function markCrawlerSourceCrawled(sourceId: number) {
  await ensureCrawlerStorage();
  await prismaClient.$executeRawUnsafe(
    `
      UPDATE crawler_source
      SET last_crawled_at = NOW(3), update_time = NOW(3)
      WHERE source_id = ?
    `,
    sourceId,
  );
}

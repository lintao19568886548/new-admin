import type {
  CrawlerSource,
  CrawlerSourceListResult,
  CrawlerSourceUpdatePayload,
} from './crawler-types';
import type { PublicCrawlerAdapter } from './public-crawler-adapters';

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
  INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE,
  PUBLIC_BUSINESS_CHANGE_SOURCE_CODE,
  PUBLIC_EIA_NOTICE_SOURCE_CODE,
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  PUBLIC_MAP_POI_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES,
  PUBLIC_RECRUITMENT_SOURCE_CODE,
  PUBLIC_TENDER_SOURCE_CODE,
  RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES,
} from './crawler-types';
import {
  GUANGDONG_CITY_NAMES,
  GUANGDONG_PROVINCE_NAME,
} from './guangdong-public-scope';
import {
  genericPublicCrawlerAdapterConfigs,
  getPublicCrawlerAdapter,
  getPublicCrawlerAdapterAllowedPaths,
  listPublicCrawlerAdapters,
} from './public-crawler-adapters';
import { assertInvestmentRadarTablesReady } from './schema-guard';

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

const PUBLIC_CRAWLER_GUANGDONG_REGION_SCOPE: string[] = [
  GUANGDONG_PROVINCE_NAME,
  ...GUANGDONG_CITY_NAMES,
];

const PUBLIC_CRAWLER_CITY_REGION_SCOPE_BY_CODE: Record<string, string[]> = {
  [PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE]: ['深圳'],
};

const DEFAULT_ENABLED_PUBLIC_OPPORTUNITY_SOURCE_CODES = new Set<string>([
  'PUBLIC_DEMAND_99CFW_GD',
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
]);

const CITY_SCOPE_RULES = [
  { patterns: ['dg.', '/dg/', 'dongguan', '441900'], scope: ['东莞'] },
  { patterns: ['sz.', '/sz/', 'shenzhen', '440300'], scope: ['深圳'] },
  { patterns: ['gz.', '/gz/', 'guangzhou', '440100'], scope: ['广州'] },
  { patterns: ['fs.', '/fs/', 'foshan', '440600'], scope: ['佛山'] },
  { patterns: ['huizhou', '441300'], scope: ['惠州'] },
  { patterns: ['zs.', '/zs/', 'zhongshan', '442000'], scope: ['中山'] },
  { patterns: ['zh.', '/zh/', 'zhuhai', '440400'], scope: ['珠海'] },
  { patterns: ['jm.', '/jm/', 'jiangmen', '440700'], scope: ['江门'] },
  { patterns: ['zq.', '/zq/', 'zhaoqing', '441200'], scope: ['肇庆'] },
] as const;

const DEFAULT_PUBLIC_CRAWLER_RATE_LIMIT_PER_MINUTE = 120;
const DEFAULT_PUBLIC_CRAWLER_INTERVAL_MINUTES = 24 * 60;
const RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODE_SET = new Set<string>(
  RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES,
);

function getPublicCrawlerRateLimitPerMinute() {
  const value = Number(
    process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_RATE_LIMIT_PER_MINUTE,
  );
  return Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_PUBLIC_CRAWLER_RATE_LIMIT_PER_MINUTE;
}

function listUrlMatchesScope(listUrl: string, scope: string) {
  const normalizedListUrl = listUrl.toLowerCase();
  const rule = CITY_SCOPE_RULES.find((item) =>
    (item.scope as readonly string[]).includes(scope),
  );
  return Boolean(
    rule?.patterns.some((pattern) => normalizedListUrl.includes(pattern)),
  );
}

function resolvePublicCrawlerRegionScope(params: {
  listUrls: string[];
  sourceCode: string;
}) {
  const explicitScope =
    PUBLIC_CRAWLER_CITY_REGION_SCOPE_BY_CODE[params.sourceCode];
  if (explicitScope) {
    return [...explicitScope];
  }

  const haystack = params.listUrls.join(' ').toLowerCase();
  const matchedScopes = CITY_SCOPE_RULES.filter((rule) =>
    rule.patterns.some((pattern) => haystack.includes(pattern)),
  ).flatMap((rule) => rule.scope);

  if (
    matchedScopes.length > 0 &&
    params.listUrls.every((listUrl) =>
      matchedScopes.some((scope) => listUrlMatchesScope(listUrl, scope)),
    )
  ) {
    return [...new Set(matchedScopes)];
  }

  return [...PUBLIC_CRAWLER_GUANGDONG_REGION_SCOPE];
}

function getPublicCrawlerListUrls(adapter: PublicCrawlerAdapter) {
  return adapter.buildListUrls?.() || [adapter.buildListUrl()];
}

function isDefaultEnabledPublicOpportunitySource(sourceCode: string) {
  return DEFAULT_ENABLED_PUBLIC_OPPORTUNITY_SOURCE_CODES.has(sourceCode);
}

interface CandidateCrawlerSourceSeed {
  allowedPathsJson: string[];
  baseUrl: string;
  blockedPathsJson: string[];
  crawlIntervalMinutes: number;
  keywordExcludeJson: string[];
  keywordIncludeJson: string[];
  rateLimitPerMinute: number;
  regionScopeJson: string[];
  robotsUrl: null | string;
  sourceCode: string;
  sourceName: string;
  sourceType: string;
}

const phase9CandidateCrawlerSources: CandidateCrawlerSourceSeed[] = [
  {
    allowedPathsJson: ['/'],
    baseUrl: 'https://www.mee.gov.cn',
    blockedPathsJson: ['/ywgz/fgbz/'],
    crawlIntervalMinutes: 1440,
    keywordExcludeJson: ['个人', '培训', '会议'],
    keywordIncludeJson: ['环评', '公示', '建设项目', '扩建', '迁建', '技改'],
    rateLimitPerMinute: 3,
    regionScopeJson: ['惠州', '东莞', '广州', '深圳', '佛山'],
    robotsUrl: 'https://www.mee.gov.cn/robots.txt',
    sourceCode: PUBLIC_EIA_NOTICE_SOURCE_CODE,
    sourceName: '生态环境公开公示候选源',
    sourceType: 'PUBLIC_EIA_NOTICE',
  },
  {
    allowedPathsJson: ['/'],
    baseUrl: 'https://www.51job.com',
    blockedPathsJson: ['/login', '/register'],
    crawlIntervalMinutes: 1440,
    keywordExcludeJson: ['门店', '导购', '兼职', '培训'],
    keywordIncludeJson: ['厂长', '生产经理', '设备工程师', '新产线', '扩产'],
    rateLimitPerMinute: 3,
    regionScopeJson: ['惠州', '东莞', '广州', '深圳', '佛山'],
    robotsUrl: 'https://www.51job.com/robots.txt',
    sourceCode: PUBLIC_RECRUITMENT_SOURCE_CODE,
    sourceName: '公开招聘扩产信号候选源',
    sourceType: 'PUBLIC_RECRUITMENT',
  },
  {
    allowedPathsJson: ['/'],
    baseUrl: 'https://www.ccgp.gov.cn',
    blockedPathsJson: ['/login', '/user'],
    crawlIntervalMinutes: 1440,
    keywordExcludeJson: ['物业服务', '办公用品', '培训服务'],
    keywordIncludeJson: ['厂房', '生产线', '设备采购', '建设工程', '产业园'],
    rateLimitPerMinute: 3,
    regionScopeJson: ['广东', '惠州', '东莞', '广州', '深圳', '佛山'],
    robotsUrl: 'https://www.ccgp.gov.cn/robots.txt',
    sourceCode: PUBLIC_TENDER_SOURCE_CODE,
    sourceName: '招投标公开信息候选源',
    sourceType: 'PUBLIC_TENDER',
  },
  {
    allowedPathsJson: ['/'],
    baseUrl: 'api://business-change',
    blockedPathsJson: [],
    crawlIntervalMinutes: 1440,
    keywordExcludeJson: ['注销', '吊销'],
    keywordIncludeJson: [
      '注册资本增加',
      '经营范围新增',
      '地址变更',
      '分支机构',
    ],
    rateLimitPerMinute: 10,
    regionScopeJson: ['惠州', '东莞', '广州', '深圳', '佛山'],
    robotsUrl: null,
    sourceCode: PUBLIC_BUSINESS_CHANGE_SOURCE_CODE,
    sourceName: '工商变更 API 候选源',
    sourceType: 'BUSINESS_CHANGE_API',
  },
  {
    allowedPathsJson: ['/'],
    baseUrl: 'api://map-poi',
    blockedPathsJson: [],
    crawlIntervalMinutes: 1440,
    keywordExcludeJson: ['住宅', '商铺', '酒店'],
    keywordIncludeJson: ['工厂', '制造', '产业园', '仓储', '物流'],
    rateLimitPerMinute: 10,
    regionScopeJson: ['惠州', '东莞', '广州', '深圳', '佛山'],
    robotsUrl: null,
    sourceCode: PUBLIC_MAP_POI_SOURCE_CODE,
    sourceName: '地图 POI 企业画像候选源',
    sourceType: 'MAP_POI_API',
  },
];

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
  const readySourceCodes = new Set([
    INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE,
    PUBLIC_EIA_NOTICE_SOURCE_CODE,
    PUBLIC_RECRUITMENT_SOURCE_CODE,
    PUBLIC_TENDER_SOURCE_CODE,
    ...PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES,
  ]);
  const adapterStatus = readySourceCodes.has(sourceCode)
    ? 'READY'
    : 'CANDIDATE';
  let allowedPathsJson = storedAllowedPaths;
  let regionScopeJson = parseStoredJsonArray(row.regionScopeJson);
  if (sourceCode === PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE) {
    allowedPathsJson = [...PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS];
  } else if (sourceCode === PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE) {
    allowedPathsJson = [...PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS];
  } else if (
    PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.includes(sourceCode as any)
  ) {
    allowedPathsJson =
      getPublicCrawlerAdapterAllowedPaths(sourceCode) || storedAllowedPaths;
  }
  if (PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.includes(sourceCode as any)) {
    const adapter = getPublicCrawlerAdapter(sourceCode);
    regionScopeJson = adapter
      ? resolvePublicCrawlerRegionScope({
          listUrls: getPublicCrawlerListUrls(adapter),
          sourceCode,
        })
      : [...PUBLIC_CRAWLER_GUANGDONG_REGION_SCOPE];
  }

  return {
    adapterStatus,
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
    regionScopeJson,
    robotsUrl: row.robotsUrl || null,
    sourceCode,
    sourceId: Number(row.sourceId),
    sourceName: row.sourceName || '',
    sourceType: row.sourceType || 'PUBLIC_OPPORTUNITY',
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

let crawlerStorageReady: null | Promise<void> = null;
let crawlerSourceCatalogReady: null | Promise<void> = null;

async function ensureCrawlerStorageUncached() {
  await assertInvestmentRadarTablesReady([
    'crawler_source',
    'crawler_task',
    'crawler_task_log',
    'crawler_task_item',
  ]);

  await ensureColumnExists({
    columnDefinition:
      'update_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)',
    columnName: 'update_time',
    tableName: 'crawler_task',
  });
}

export async function ensureCrawlerStorage() {
  if (crawlerStorageReady) {
    return crawlerStorageReady;
  }

  crawlerStorageReady = ensureCrawlerStorageUncached().catch((error) => {
    crawlerStorageReady = null;
    throw error;
  });

  return crawlerStorageReady;
}

async function ensureCrawlerSourceCatalogUncached() {
  await ensureCrawlerStorage();
  const publicOpportunity99CfwAdapter = getPublicCrawlerAdapter(
    PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
  );
  const publicOpportunity99CfwListUrls = publicOpportunity99CfwAdapter
    ? getPublicCrawlerListUrls(publicOpportunity99CfwAdapter)
    : [];

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO crawler_source (
        source_code, source_name, source_type, base_url, robots_url, enabled,
        crawl_interval_minutes, rate_limit_per_minute,
        allowed_paths_json, blocked_paths_json,
        keyword_include_json, keyword_exclude_json, region_scope_json,
        create_time, update_time
      )
      VALUES (?, 'Internal contract expiry signal', 'INTERNAL_CONTRACT',
        'internal://rental-tenant/contract-expiry', NULL, 1,
        1440, 60, ?, ?, ?, ?, NULL, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        source_name = VALUES(source_name),
        source_type = VALUES(source_type),
        base_url = VALUES(base_url),
        robots_url = VALUES(robots_url),
        update_time = update_time
    `,
    INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE,
    JSON.stringify(['/rental-tenant/contract-expiry']),
    JSON.stringify([]),
    JSON.stringify(['合同到期', '续租', '退租', '搬迁', '扩租']),
    JSON.stringify(['已删除']),
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
        ?, NULL, 0,
        ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        source_name = VALUES(source_name),
        source_type = VALUES(source_type),
        base_url = VALUES(base_url),
        robots_url = VALUES(robots_url),
        enabled = VALUES(enabled),
        crawl_interval_minutes = VALUES(crawl_interval_minutes),
        rate_limit_per_minute = VALUES(rate_limit_per_minute),
        allowed_paths_json = VALUES(allowed_paths_json),
        region_scope_json = VALUES(region_scope_json),
        update_time = update_time
    `,
    PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
    publicOpportunity99CfwListUrls[0] ||
      PUBLIC_OPPORTUNITY_99CFW_ALLOWED_ORIGIN,
    DEFAULT_PUBLIC_CRAWLER_INTERVAL_MINUTES,
    getPublicCrawlerRateLimitPerMinute(),
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
    JSON.stringify(
      resolvePublicCrawlerRegionScope({
        listUrls: publicOpportunity99CfwListUrls,
        sourceCode: PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
      }),
    ),
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
        ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        source_name = VALUES(source_name),
        source_type = VALUES(source_type),
        base_url = VALUES(base_url),
        robots_url = VALUES(robots_url),
        enabled = VALUES(enabled),
        crawl_interval_minutes = VALUES(crawl_interval_minutes),
        rate_limit_per_minute = VALUES(rate_limit_per_minute),
        allowed_paths_json = VALUES(allowed_paths_json),
        region_scope_json = VALUES(region_scope_json),
        update_time = update_time
    `,
    PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
    PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN,
    DEFAULT_PUBLIC_CRAWLER_INTERVAL_MINUTES,
    getPublicCrawlerRateLimitPerMinute(),
    JSON.stringify(PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS),
    JSON.stringify([]),
    JSON.stringify(['厂房', '出租', '招租', '分租', '平方', '平米']),
    JSON.stringify(['求租', '出售', '写字楼', '住宅', '商铺']),
    JSON.stringify(
      resolvePublicCrawlerRegionScope({
        listUrls: [`${PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN}/sz/cfcz/`],
        sourceCode: PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
      }),
    ),
  );
  for (const source of genericPublicCrawlerAdapterConfigs) {
    const adapter = getPublicCrawlerAdapter(source.sourceCode);
    const listUrls = adapter
      ? getPublicCrawlerListUrls(adapter)
      : source.listUrls;
    const enabled = isDefaultEnabledPublicOpportunitySource(source.sourceCode)
      ? 1
      : 0;
    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO crawler_source (
          source_code, source_name, source_type, base_url, robots_url, enabled,
          crawl_interval_minutes, rate_limit_per_minute,
          allowed_paths_json, blocked_paths_json,
          keyword_include_json, keyword_exclude_json, region_scope_json,
          create_time, update_time
        )
        VALUES (?, ?, 'PUBLIC_OPPORTUNITY',
          ?, NULL, ?,
          ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          source_name = VALUES(source_name),
          source_type = VALUES(source_type),
          base_url = VALUES(base_url),
          robots_url = VALUES(robots_url),
          enabled = VALUES(enabled),
          crawl_interval_minutes = VALUES(crawl_interval_minutes),
          rate_limit_per_minute = VALUES(rate_limit_per_minute),
          allowed_paths_json = VALUES(allowed_paths_json),
          blocked_paths_json = VALUES(blocked_paths_json),
          keyword_include_json = VALUES(keyword_include_json),
          keyword_exclude_json = VALUES(keyword_exclude_json),
          region_scope_json = VALUES(region_scope_json),
          update_time = update_time
      `,
      source.sourceCode,
      source.sourceName,
      listUrls[0] || source.allowedHosts[0],
      enabled,
      DEFAULT_PUBLIC_CRAWLER_INTERVAL_MINUTES,
      getPublicCrawlerRateLimitPerMinute(),
      JSON.stringify(
        getPublicCrawlerAdapterAllowedPaths(source.sourceCode) ||
          source.detailPathPrefixes ||
          [],
      ),
      JSON.stringify([]),
      JSON.stringify(['厂房', '仓库', '出租', '招租', '分租', '平方', '平米']),
      JSON.stringify(['住宅', '商铺', '写字楼', '公寓']),
      JSON.stringify(
        resolvePublicCrawlerRegionScope({
          listUrls,
          sourceCode: source.sourceCode,
        }),
      ),
    );
  }
  const seededPublicAdapterSourceCodes = new Set([
    PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
    PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
    ...genericPublicCrawlerAdapterConfigs.map((source) => source.sourceCode),
  ]);
  for (const adapter of listPublicCrawlerAdapters()) {
    if (seededPublicAdapterSourceCodes.has(adapter.sourceCode)) {
      continue;
    }
    const isSupply = adapter.opportunityType === 'SUPPLY';
    const enabled = isDefaultEnabledPublicOpportunitySource(adapter.sourceCode)
      ? 1
      : 0;
    const listUrls = getPublicCrawlerListUrls(adapter);
    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO crawler_source (
          source_code, source_name, source_type, base_url, robots_url, enabled,
          crawl_interval_minutes, rate_limit_per_minute,
          allowed_paths_json, blocked_paths_json,
          keyword_include_json, keyword_exclude_json, region_scope_json,
          create_time, update_time
        )
        VALUES (?, ?, 'PUBLIC_OPPORTUNITY',
          ?, NULL, ?,
          ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          source_name = VALUES(source_name),
          source_type = VALUES(source_type),
          base_url = VALUES(base_url),
          robots_url = VALUES(robots_url),
          enabled = VALUES(enabled),
          crawl_interval_minutes = VALUES(crawl_interval_minutes),
          rate_limit_per_minute = VALUES(rate_limit_per_minute),
          allowed_paths_json = VALUES(allowed_paths_json),
          blocked_paths_json = VALUES(blocked_paths_json),
          keyword_include_json = VALUES(keyword_include_json),
          keyword_exclude_json = VALUES(keyword_exclude_json),
          region_scope_json = VALUES(region_scope_json),
          update_time = update_time
      `,
      adapter.sourceCode,
      adapter.platformName || adapter.sourceCode,
      listUrls[0] || adapter.buildListUrl(),
      enabled,
      DEFAULT_PUBLIC_CRAWLER_INTERVAL_MINUTES,
      getPublicCrawlerRateLimitPerMinute(),
      JSON.stringify(adapter.allowedPaths),
      JSON.stringify([]),
      JSON.stringify(
        isSupply
          ? ['厂房', '仓库', '出租', '招租', '分租', '平方', '平米']
          : [
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
            ],
      ),
      JSON.stringify(
        isSupply
          ? ['住宅', '商铺', '写字楼', '公寓']
          : ['住宅', '商铺', '个人', '培训', '会议', '活动宣传'],
      ),
      JSON.stringify(
        resolvePublicCrawlerRegionScope({
          listUrls,
          sourceCode: adapter.sourceCode,
        }),
      ),
    );
  }
  for (const source of phase9CandidateCrawlerSources) {
    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO crawler_source (
          source_code, source_name, source_type, base_url, robots_url, enabled,
          crawl_interval_minutes, rate_limit_per_minute,
          allowed_paths_json, blocked_paths_json,
          keyword_include_json, keyword_exclude_json, region_scope_json,
          create_time, update_time
        )
        VALUES (
          ?, ?, ?, ?, ?, 0,
          ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3)
        )
        ON DUPLICATE KEY UPDATE
          source_name = VALUES(source_name),
          source_type = VALUES(source_type),
          base_url = VALUES(base_url),
          robots_url = VALUES(robots_url),
          enabled = VALUES(enabled),
          crawl_interval_minutes = VALUES(crawl_interval_minutes),
          rate_limit_per_minute = VALUES(rate_limit_per_minute),
          allowed_paths_json = VALUES(allowed_paths_json),
          blocked_paths_json = VALUES(blocked_paths_json),
          keyword_include_json = VALUES(keyword_include_json),
          keyword_exclude_json = VALUES(keyword_exclude_json),
          region_scope_json = VALUES(region_scope_json),
          update_time = update_time
      `,
      source.sourceCode,
      source.sourceName,
      source.sourceType,
      source.baseUrl,
      source.robotsUrl,
      source.crawlIntervalMinutes,
      source.rateLimitPerMinute,
      JSON.stringify(source.allowedPathsJson),
      JSON.stringify(source.blockedPathsJson),
      JSON.stringify(source.keywordIncludeJson),
      JSON.stringify(source.keywordExcludeJson),
      JSON.stringify(source.regionScopeJson),
    );
  }
}

export async function ensureCrawlerSourceCatalog() {
  if (crawlerSourceCatalogReady) {
    return crawlerSourceCatalogReady;
  }

  crawlerSourceCatalogReady = ensureCrawlerSourceCatalogUncached().catch(
    (error) => {
      crawlerSourceCatalogReady = null;
      throw error;
    },
  );

  return crawlerSourceCatalogReady;
}

export async function listCrawlerSources(): Promise<CrawlerSourceListResult> {
  await ensureCrawlerSourceCatalog();

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

  const visibleRows = rows.filter(
    (row) =>
      row.sourceType !== 'DEMO' &&
      !RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODE_SET.has(row.sourceCode || ''),
  );

  return {
    items: visibleRows.map((row) => mapSourceRow(row)),
    total: visibleRows.length,
  };
}

export async function getCrawlerSourceById(
  sourceId: number,
): Promise<CrawlerSource | null> {
  await ensureCrawlerSourceCatalog();

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
  if (RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODE_SET.has(sourceCode)) {
    return null;
  }

  await ensureCrawlerSourceCatalog();
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

export function getInternalContractExpiryCrawlerSource() {
  return getCrawlerSourceByCode(INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE);
}

export function getPublicOpportunityCrawlerSource() {
  return getCrawlerSourceByCode(PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE);
}

export const getDemoCrawlerSource = getPublicOpportunityCrawlerSource;

export function getPublicFactoryListingCrawlerSource() {
  return getCrawlerSourceByCode(PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE);
}

export async function listPublicOpportunityCrawlerSources() {
  const sources = await Promise.all(
    PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.map((sourceCode) =>
      getCrawlerSourceByCode(sourceCode),
    ),
  );
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
    const adapter = getPublicCrawlerAdapter(source.sourceCode);
    const listUrls = adapter ? getPublicCrawlerListUrls(adapter) : [];
    normalized.regionScopeJson = resolvePublicCrawlerRegionScope({
      listUrls,
      sourceCode: PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
    });
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
    normalized.regionScopeJson = resolvePublicCrawlerRegionScope({
      listUrls: [`${PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN}/sz/cfcz/`],
      sourceCode: PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
    });
    normalized.robotsUrl = null;
  } else {
    const adapter = getPublicCrawlerAdapter(source.sourceCode);
    if (adapter) {
      const listUrls = getPublicCrawlerListUrls(adapter);
      normalized.allowedPathsJson =
        getPublicCrawlerAdapterAllowedPaths(source.sourceCode) ||
        source.allowedPathsJson;
      normalized.regionScopeJson = resolvePublicCrawlerRegionScope({
        listUrls,
        sourceCode: source.sourceCode,
      });
      normalized.robotsUrl = null;
    } else if (
      normalized.robotsUrl === null &&
      source.sourceType !== 'INTERNAL_CONTRACT'
    ) {
      throw new CrawlerSourceValidationError(
        'robotsUrl can only be empty for sources with built-in fetch policy',
      );
    }
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

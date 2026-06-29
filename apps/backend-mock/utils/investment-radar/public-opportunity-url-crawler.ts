import type { ParsedPublicOpportunity } from './crawler-adapters/types';
import type {
  CrawlerTask,
  CrawlerTaskItem,
  PublicOpportunityCrawlerRunOptions,
} from './crawler-types';
import type { PublicOpportunityRow } from './public-opportunity-lead-policy';
import type {
  PublicListDiscoveryContentIssueSample,
  PublicListPageContentSignals,
} from './public-opportunity-list-discovery';
import type { PublicOpportunityCrawlerInput } from './public-opportunity-repository';

import { createHash } from 'node:crypto';

import { prismaClient } from '../db';
import {
  checkCrawlerIntervalPolicy,
  checkCrawlerSourcePolicy,
} from './crawler-policy';
import {
  getPublicCrawlerSourceByCode,
  getPublicFactoryListingCrawlerSource,
  getPublicOpportunityCrawlerSource,
  markCrawlerSourceCrawled,
} from './crawler-source-repository';
import {
  claimCrawlerTaskItem,
  listRunnableCrawlerTaskItems,
  markCrawlerTaskItemFailed,
  markCrawlerTaskItemSkipped,
  markCrawlerTaskItemSuccess,
  reclaimStaleRunningCrawlerTaskItems,
  seedCrawlerTaskItems,
} from './crawler-task-item-repository';
import {
  appendCrawlerTaskLog,
  CrawlerTaskValidationError,
  createCrawlerTask,
  getCrawlerTaskDetail,
  updateCrawlerTaskStatus,
} from './crawler-task-repository';
import {
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_FRESHNESS_DAYS,
  PUBLIC_OPPORTUNITY_TASK_BUDGET_MS,
} from './crawler-types';
import { upsertExternalLeadFromCrawler } from './external-lead-repository';
import {
  GUANGDONG_PROVINCE_NAME,
  isWithinGuangdongScope,
  normalizeGuangdongCity,
  resolveGuangdongCityFromText,
} from './guangdong-public-scope';
import { getPublicCrawlerAdapter } from './public-crawler-adapters';
import { buildExternalLeadInputFromPublicOpportunityRow } from './public-opportunity-lead-policy';
import {
  createEmptyPublicListDiscoveryResult,
  resolvePublicOpportunityTaskFinishOutcome,
} from './public-opportunity-list-discovery';
import {
  PublicOpportunityQualitySkipError,
  upsertCrawlerPublicOpportunity,
} from './public-opportunity-repository';

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_FRESHNESS_DAYS = PUBLIC_OPPORTUNITY_FRESHNESS_DAYS;
const DEFAULT_MAX_LIST_PAGES = 60;
const MAX_BATCH_SIZE = 1000;
const MAX_LIST_PAGES = 500;
const DEFAULT_MAX_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MINUTES = 30;
const DEFAULT_LIST_DISCOVERY_DELAY_MS = 1000;
const DEFAULT_STALE_RUNNING_MINUTES = 15;
const DEFAULT_STALE_REPROCESS_MINUTES = 24 * 60;
const DEFAULT_QUEUE_SCAN_MULTIPLIER = 100;
const MIN_QUEUE_SCAN_LIMIT = 1000;
const MAX_QUEUE_SCAN_LIMIT = 1000;
const MAX_QUEUE_POLICY_SKIP_COUNT = MAX_QUEUE_SCAN_LIMIT;
const SEED_ROW_BATCH_MULTIPLIER = 3;
const FETCH_TIMEOUT_MS = 10_000;
const RESPONSE_TEXT_TIMEOUT_MS = 10_000;
const SHENZHEN_CITY_NAME = '\u6DF1\u5733';
const GUANGDONG_PROVINCE_TEXT = GUANGDONG_PROVINCE_NAME.replace(/省$/, '');
const PUBLIC_DEMAND_SCOPE_SKIP_LOG_MESSAGE =
  'public demand skipped by Guangdong and freshness scope';
const PUBLIC_CRAWLER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

interface DiscoveredPublicUrl {
  publishedAt?: null | string;
  sourceTitle?: null | string;
  sourceUrl: string;
}

interface SyntheticOpportunityParseMeta {
  areaText?: null | string;
  city?: null | string;
  companyName?: null | string;
  contactName?: null | string;
  district?: null | string;
  industryText?: null | string;
  phoneNumber?: null | string;
  priceText?: null | string;
  publishedAt?: null | string;
  strictCity?: null | string;
  strictDistrict?: null | string;
  title?: null | string;
  urlInferredCity?: null | string;
  urlInferredDistrict?: null | string;
}

interface OpportunityUpsertPayload {
  parseMeta?: null | SyntheticOpportunityParseMeta;
  responseHash?: null | string;
  row: PublicOpportunityRow;
  sourceCode: string;
  sourceName: string;
  sourceUrl: string;
}

interface DemandCrawlerScopePolicyInput {
  bodyText?: null | string;
  freshnessDays: number;
  opportunityType: string;
  parseMeta?: null | SyntheticOpportunityParseMeta;
  publishedAt?: null | string;
  row?: null | PublicOpportunityRow;
  sourceUrl: string;
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function normalizeOptions(options: PublicOpportunityCrawlerRunOptions = {}) {
  return {
    batchSize: clampInt(
      options.batchSize,
      DEFAULT_BATCH_SIZE,
      1,
      MAX_BATCH_SIZE,
    ),
    discoverList: options.discoverList !== false,
    freshnessDays: clampInt(
      options.freshnessDays,
      DEFAULT_FRESHNESS_DAYS,
      1,
      DEFAULT_FRESHNESS_DAYS,
    ),
    ignoreInterval: options.ignoreInterval === true,
    listDiscoveryDelayMs: clampInt(
      options.listDiscoveryDelayMs,
      DEFAULT_LIST_DISCOVERY_DELAY_MS,
      0,
      60_000,
    ),
    maxListPages: clampInt(
      options.maxListPages,
      DEFAULT_MAX_LIST_PAGES,
      1,
      MAX_LIST_PAGES,
    ),
    maxRetryCount: clampInt(
      options.maxRetryCount,
      DEFAULT_MAX_RETRY_COUNT,
      1,
      10,
    ),
    reprocessSuccess: options.reprocessSuccess === true,
    retryDelayMinutes: clampInt(
      options.retryDelayMinutes,
      DEFAULT_RETRY_DELAY_MINUTES,
      1,
      24 * 60,
    ),
    staleReprocessMinutes: clampInt(
      options.staleReprocessMinutes,
      DEFAULT_STALE_REPROCESS_MINUTES,
      1,
      24 * 60,
    ),
  };
}

function parseCrawlerDate(value: null | string | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildDemandCrawlerScopeSkipReason(
  input: DemandCrawlerScopePolicyInput,
) {
  if (input.opportunityType !== 'DEMAND') {
    return null;
  }

  const publishedAt =
    input.publishedAt || input.parseMeta?.publishedAt || input.row?.publishedAt;
  const publishedDate = parseCrawlerDate(publishedAt);
  if (!publishedDate) {
    return 'PUBLIC_DEMAND_PUBLISHED_AT_MISSING';
  }
  const now = new Date();
  if (publishedDate.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
    return 'PUBLIC_DEMAND_PUBLISHED_AT_INVALID';
  }
  const freshnessWindowMs = input.freshnessDays * 24 * 60 * 60 * 1000;
  if (now.getTime() - publishedDate.getTime() > freshnessWindowMs) {
    return 'PUBLIC_DEMAND_OUT_OF_180_DAY_SCOPE';
  }

  const detailJsonText = stringifyCrawlerJson(input.row?.detailJson);
  const scopeText = normalizeCrawlerText(
    [
      input.row?.city,
      input.row?.district,
      input.row?.title,
      input.row?.description,
      input.parseMeta?.city,
      input.parseMeta?.district,
      input.parseMeta?.title,
      input.parseMeta?.industryText,
      input.bodyText,
      detailJsonText,
    ]
      .filter(Boolean)
      .join(' '),
  );
  if (
    !isWithinGuangdongScope({
      city: input.row?.city || input.parseMeta?.city,
      district: input.row?.district || input.parseMeta?.district,
      sourceUrl: input.sourceUrl,
      text: scopeText,
    })
  ) {
    return 'PUBLIC_DEMAND_OUT_OF_GUANGDONG_SCOPE';
  }

  return null;
}

async function skipCrawlerTaskItemByDemandScope(params: {
  finalUrl: string;
  freshnessDays: number;
  item: CrawlerTaskItem;
  parseMeta?: null | SyntheticOpportunityParseMeta;
  reason: string;
  responseHash: string;
  taskId: number;
}) {
  await markCrawlerTaskItemSkipped({
    itemId: params.item.itemId,
    parsedPayload: {
      finalUrl: params.finalUrl,
      freshnessDays: params.freshnessDays,
      parseMeta: params.parseMeta || null,
      responseHash: params.responseHash,
      scopeProvince: GUANGDONG_PROVINCE_NAME,
    },
    reason: params.reason,
    taskId: params.taskId,
  });
  await appendCrawlerTaskLog({
    detail: {
      finalUrl: params.finalUrl,
      freshnessDays: params.freshnessDays,
      itemId: params.item.itemId,
      parseMeta: params.parseMeta || null,
      reason: params.reason,
      scopeProvince: GUANGDONG_PROVINCE_NAME,
      sourceUrl: params.item.sourceUrl,
    },
    level: 'WARN',
    message: PUBLIC_DEMAND_SCOPE_SKIP_LOG_MESSAGE,
    stage: 'POLICY_SKIP',
    taskId: params.taskId,
  });
}

function toSafeNumberId(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && numberValue > 0
    ? numberValue
    : null;
}

function normalizePublicOpportunityRow(
  row: PublicOpportunityRow,
): PublicOpportunityRow {
  return {
    ...row,
    opportunityId: toSafeNumberId(row.opportunityId) || 0,
  };
}

function normalizePublicOpportunityRows(rows: PublicOpportunityRow[]) {
  return rows.map((row) => normalizePublicOpportunityRow(row));
}

function buildUrlPolicyFailureReason(
  sourceUrl: string,
  source?: {
    allowedPathsJson?: null | string[];
    blockedPathsJson?: null | string[];
    sourceCode?: string;
  },
) {
  const adapter = getPublicCrawlerAdapter(source?.sourceCode || '');
  return adapter
    ? adapter.validateDetailUrl(sourceUrl, source)
    : 'SOURCE_ADAPTER_NOT_FOUND';
}

function isAllowedSourceUrl(
  sourceUrl: string,
  source?: {
    allowedPathsJson?: null | string[];
    blockedPathsJson?: null | string[];
  },
) {
  return !buildUrlPolicyFailureReason(sourceUrl, source);
}

function resolveQueueScanLimit(batchSize: number) {
  return Math.min(
    MAX_QUEUE_SCAN_LIMIT,
    Math.max(
      batchSize,
      MIN_QUEUE_SCAN_LIMIT,
      batchSize * DEFAULT_QUEUE_SCAN_MULTIPLIER,
    ),
  );
}

function resolveSeedRowLimit(batchSize: number) {
  return Math.max(
    batchSize,
    Math.min(300, batchSize * SEED_ROW_BATCH_MULTIPLIER),
  );
}

function resolveRateLimitDelayMs(rateLimitPerMinute: number) {
  const normalized = Math.max(1, Math.floor(Number(rateLimitPerMinute) || 1));
  return Math.ceil((60 * 1000) / normalized);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTaskBudgetExceeded(startedAt: Date) {
  return Date.now() - startedAt.getTime() >= PUBLIC_OPPORTUNITY_TASK_BUDGET_MS;
}

async function withTimeout<T>(
  runner: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      runner(),
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(timeoutMessage)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function querySeedDemandRows(limit: number) {
  const rows = await prismaClient.$queryRawUnsafe<PublicOpportunityRow[]>(
    `
      SELECT
        opportunity_id AS opportunityId,
        opportunity_type AS opportunityType,
        source_site AS sourceSite,
        source_table AS sourceTable,
        source_url AS sourceUrl,
        title,
        city,
        district,
        area_text AS areaText,
        area_sqm AS areaSqm,
        price_text AS priceText,
        industry_text AS industryText,
        contact_name AS contactName,
        phone_number AS phoneNumber,
        description,
        published_at AS publishedAt,
        tags_json AS tagsJson,
        detail_json AS detailJson,
        last_synced_at AS lastSyncedAt
      FROM investment_public_opportunity
      WHERE opportunity_type = 'DEMAND'
        AND source_site = '99cfw'
        AND source_url IS NOT NULL
        AND source_url <> ''
      ORDER BY
        CASE WHEN published_at IS NULL THEN 1 ELSE 0 END ASC,
        published_at DESC,
        opportunity_id DESC
      LIMIT ?
    `,
    limit,
  );
  return normalizePublicOpportunityRows(rows);
}

async function querySeedRowsByType(params: {
  limit: number;
  opportunityType: 'DEMAND' | 'SUPPLY';
  sourceSite: string;
}) {
  const rows = await prismaClient.$queryRawUnsafe<PublicOpportunityRow[]>(
    `
      SELECT
        opportunity_id AS opportunityId,
        opportunity_type AS opportunityType,
        source_site AS sourceSite,
        source_table AS sourceTable,
        source_url AS sourceUrl,
        title,
        city,
        district,
        area_text AS areaText,
        area_sqm AS areaSqm,
        price_text AS priceText,
        industry_text AS industryText,
        contact_name AS contactName,
        phone_number AS phoneNumber,
        description,
        published_at AS publishedAt,
        tags_json AS tagsJson,
        detail_json AS detailJson,
        last_synced_at AS lastSyncedAt
      FROM investment_public_opportunity
      WHERE opportunity_type = ?
        AND source_site = ?
        AND source_url IS NOT NULL
        AND source_url <> ''
      ORDER BY
        CASE WHEN published_at IS NULL THEN 1 ELSE 0 END ASC,
        published_at DESC,
        opportunity_id DESC
      LIMIT ?
    `,
    params.opportunityType,
    params.sourceSite,
    params.limit,
  );
  return normalizePublicOpportunityRows(rows);
}

async function getPublicOpportunityRowById(opportunityId: number) {
  const rows = await prismaClient.$queryRawUnsafe<PublicOpportunityRow[]>(
    `
      SELECT
        opportunity_id AS opportunityId,
        opportunity_type AS opportunityType,
        source_site AS sourceSite,
        source_table AS sourceTable,
        source_url AS sourceUrl,
        title,
        city,
        district,
        area_text AS areaText,
        area_sqm AS areaSqm,
        price_text AS priceText,
        industry_text AS industryText,
        contact_name AS contactName,
        phone_number AS phoneNumber,
        description,
        published_at AS publishedAt,
        tags_json AS tagsJson,
        detail_json AS detailJson,
        last_synced_at AS lastSyncedAt
      FROM investment_public_opportunity
      WHERE opportunity_id = ?
      LIMIT 1
    `,
    opportunityId,
  );
  return rows[0] ? normalizePublicOpportunityRow(rows[0]) : null;
}

function stripHtml(html: string) {
  return html
    .replaceAll(/<script[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/&nbsp;/gi, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

function extractHtmlTitle(html: string) {
  const match = /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i.exec(html || '');
  return match?.[1] ? stripHtml(match[1]).slice(0, 160) : null;
}

function buildListPageContentSignals(bodyText: string) {
  const normalizedText = String(bodyText || '').toLowerCase();
  return {
    hasAntiBotHint:
      /captcha|verify|verification|robot|security|geetest|cloudflare|cf-chl|waf|incapsula|访问验证|安全验证|验证码|人机验证|滑块验证/.test(
        normalizedText,
      ) ||
      /请完成.*验证|验证后继续|verify you are human|checking your browser/.test(
        normalizedText,
      ),
    hasBlockedHint:
      /403|forbidden|access denied|blocked|rate limit|too many requests|拒绝访问|禁止访问|访问受限|访问频繁|请求过于频繁|ip被封/.test(
        normalizedText,
      ),
    hasDetailHint:
      /联系人|联系电话|联系方式|电话|手机|面积|租金|价格|地址|发布时间|厂房|仓库|求租|求购|需求|出租|出售|园区|工业园/.test(
        normalizedText,
      ),
    hasEmptyHint:
      /暂无|没有找到|无结果|no data|not found|没有相关|暂未发布|404|dns_probe_finished_nxdomain/i.test(
        normalizedText,
      ),
    hasLoginRedirectHint:
      /请先登录|请登录后|登录后查看|登陆后查看|登录后才能|登陆后才能|需要登录|会员登录|用户登录|login required|please login|sign in to|signin required/.test(
        normalizedText,
      ) ||
      /window\.location\.href\s*=\s*["'][^"']*(?:login|member|user)/.test(
        normalizedText,
      ),
    hasListingHint: /厂房|仓库|出租|面积|租金|房源|供应|求租|求购|需求/.test(
      normalizedText,
    ),
    hasNotFoundHint:
      /404|not found|page not found|页面不存在|内容不存在|资源不存在|已删除|已下架|信息不存在/.test(
        normalizedText,
      ),
  } satisfies PublicListPageContentSignals;
}

function resolveListPageContentIssue(params: {
  bodyText: string;
  discoveredDetailCount: number;
  discoveredListCount: number;
  signals: PublicListPageContentSignals;
}) {
  if (params.signals.hasAntiBotHint) {
    return 'ANTI_BOT';
  }
  if (params.signals.hasBlockedHint) {
    return 'BLOCKED';
  }
  if (params.signals.hasLoginRedirectHint) {
    return 'LOGIN_REQUIRED';
  }
  if (params.bodyText.trim().length === 0) {
    return 'EMPTY_BODY';
  }
  if (params.signals.hasNotFoundHint) {
    return 'NOT_FOUND';
  }
  if (params.discoveredDetailCount > 0 || params.discoveredListCount > 0) {
    return null;
  }
  if (params.signals.hasEmptyHint) {
    return 'EMPTY_LIST';
  }
  if (!params.signals.hasListingHint) {
    return 'NO_LISTING_SIGNAL';
  }
  return null;
}

function resolveDetailPageContentIssue(params: {
  bodyText: string;
  signals: PublicListPageContentSignals;
}) {
  if (params.signals.hasAntiBotHint) {
    return { action: 'RETRY' as const, code: 'ANTI_BOT' };
  }
  if (params.signals.hasBlockedHint) {
    return { action: 'RETRY' as const, code: 'BLOCKED' };
  }
  if (params.signals.hasLoginRedirectHint) {
    return { action: 'RETRY' as const, code: 'LOGIN_REQUIRED' };
  }
  if (params.bodyText.trim().length === 0) {
    return { action: 'SKIP' as const, code: 'EMPTY_BODY' };
  }
  if (params.signals.hasNotFoundHint) {
    return { action: 'SKIP' as const, code: 'NOT_FOUND' };
  }
  return null;
}

function pushListDiscoveryContentIssue(
  samples: PublicListDiscoveryContentIssueSample[],
  sample: PublicListDiscoveryContentIssueSample,
) {
  if (samples.length >= 5) {
    return;
  }
  samples.push(sample);
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replaceAll(/\\u002f/gi, '/')
    .replaceAll(String.raw`\/`, '/')
    .replaceAll(/&amp;/gi, '&')
    .replaceAll(/&lt;/gi, '<')
    .replaceAll(/&gt;/gi, '>')
    .replaceAll(/&quot;/gi, '"')
    .replaceAll('&#39;', "'")
    .replaceAll(/&nbsp;/gi, ' ');
}

function normalizeDiscoveredUrl(href: string, baseUrl: string) {
  try {
    const decodedHref = decodeBasicHtmlEntities(href).trim();
    if (!decodedHref || /^(?:#|javascript:|mailto:|tel:)/i.test(decodedHref)) {
      return null;
    }
    const protocolMatches = [...decodedHref.matchAll(/https?:\/\//gi)];
    const lastProtocolIndex = protocolMatches.at(-1)?.index;
    const absoluteUrlMatches = decodedHref.match(/https?:\/\/[^\s"'<>]+/gi);
    let normalizedHref = decodedHref;
    if (protocolMatches.length > 1 && lastProtocolIndex !== undefined) {
      normalizedHref = decodedHref.slice(lastProtocolIndex);
    } else if (absoluteUrlMatches && absoluteUrlMatches.length > 0) {
      normalizedHref =
        absoluteUrlMatches[absoluteUrlMatches.length - 1] || decodedHref;
    }
    const url = new URL(normalizedHref, baseUrl);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function extractPublicOpportunityEmbeddedUrlCandidates(
  html: string,
  listUrl: string,
) {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const pushCandidate = (rawUrl: string) => {
    const sourceUrl = normalizeDiscoveredUrl(rawUrl, listUrl);
    if (!sourceUrl || seen.has(sourceUrl)) {
      return;
    }
    seen.add(sourceUrl);
    candidates.push(sourceUrl);
  };

  const jsonUrlPattern =
    /["'](?:url|href|link|detailUrl|detail_url|detailHref|detail_href|houseUrl|house_url|pcUrl|pc_url|jumpUrl|jump_url|sourceUrl|source_url|urlPath|url_path|path)["']\s*:\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(jsonUrlPattern)) {
    pushCandidate(match[1] || '');
  }

  const dataUrlPattern =
    /\b(?:data-url|data-href|data-link|data-detail-url|data-source-url|data-clipboard-text|data-src|data-original|data-jump-url|data-pc-url)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(dataUrlPattern)) {
    pushCandidate(match[1] || '');
  }

  const scriptNavigationPattern =
    /\b(?:window\.open|open|goDetail|toDetail)\s*\(\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(scriptNavigationPattern)) {
    pushCandidate(match[1] || '');
  }

  const locationAssignmentPattern =
    /\b(?:location\.href|window\.location|location)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(locationAssignmentPattern)) {
    pushCandidate(match[1] || '');
  }

  const escapedAbsoluteUrlPattern = /https?:\\\/\\\/[^\s"'<>]+/gi;
  for (const match of html.matchAll(escapedAbsoluteUrlPattern)) {
    pushCandidate(match[0] || '');
  }

  const absoluteUrlPattern = /(?:https?:)?\/\/[^\s"'<>\\]+/gi;
  for (const match of html.matchAll(absoluteUrlPattern)) {
    pushCandidate(match[0] || '');
  }

  return candidates;
}

function normalizePublishedAtText(value: unknown) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return null;
  }
  const normalizedValue = rawValue
    .replace('年', '-')
    .replace('月', '-')
    .replace('日', '')
    .replaceAll('/', '-')
    .replaceAll('.', '-')
    .replace('T', ' ');
  const match =
    /^(20\d{2})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(
      normalizedValue,
    );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  const parts = {
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    month: Number(month),
    second: Number(second),
    year: Number(year),
  };
  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59 ||
    parts.second < 0 ||
    parts.second > 59
  ) {
    return null;
  }
  const date = new Date(
    `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(
      2,
      '0',
    )}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}+08:00`,
  );
  const shanghaiParts = getShanghaiDateParts(date);
  if (
    Number.isNaN(date.getTime()) ||
    shanghaiParts.year !== parts.year ||
    shanghaiParts.month !== parts.month ||
    shanghaiParts.day !== parts.day
  ) {
    return null;
  }
  return date.toISOString();
}

function extractJsonLdBlocks(html: string) {
  const blocks: string[] = [];
  const scriptPattern =
    /<script(?:\s[^>]*)?type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const content = decodeBasicHtmlEntities(match[1] || '').trim();
    if (content) {
      blocks.push(content);
    }
  }
  return blocks;
}

function visitJsonValue(value: unknown, visitor: (value: unknown) => void) {
  visitor(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      visitJsonValue(item, visitor);
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      visitJsonValue(item, visitor);
    }
  }
}

function extractPublicOpportunityJsonLdUrls(html: string, listUrl: string) {
  const discovered: DiscoveredPublicUrl[] = [];
  for (const block of extractJsonLdBlocks(html)) {
    try {
      const parsed = JSON.parse(block) as unknown;
      visitJsonValue(parsed, (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return;
        }
        const record = value as Record<string, unknown>;
        const sourceUrl = normalizeDiscoveredUrl(
          String(record.url || ''),
          listUrl,
        );
        if (!sourceUrl) {
          return;
        }
        discovered.push({
          publishedAt: normalizePublishedAtText(record.datePublished),
          sourceTitle:
            String(record.name || record.headline || '').trim() || null,
          sourceUrl,
        });
      });
    } catch {
      const urlMatch = /"url"\s*:\s*"([^"]+)"/i.exec(block);
      if (!urlMatch?.[1]) {
        continue;
      }
      discovered.push({
        publishedAt: normalizePublishedAtText(
          /"datePublished"\s*:\s*"([^"]+)"/i.exec(block)?.[1],
        ),
        sourceTitle:
          decodeUnicodeEscapes(
            /"name"\s*:\s*"([^"]+)"/i.exec(block)?.[1] || '',
          ).trim() || null,
        sourceUrl: normalizeDiscoveredUrl(urlMatch[1], listUrl) || urlMatch[1],
      });
    }
  }
  return discovered;
}

function extractPublicOpportunityDetailUrls(
  html: string,
  listUrl: string,
  source?: {
    allowedPathsJson?: null | string[];
    blockedPathsJson?: null | string[];
    sourceCode?: string;
  },
) {
  const discovered: DiscoveredPublicUrl[] = [];
  const seen = new Set<string>();
  const adapter = getPublicCrawlerAdapter(source?.sourceCode || '');
  const pushDiscovered = (item: DiscoveredPublicUrl) => {
    if (!item.sourceUrl || seen.has(item.sourceUrl)) {
      return;
    }
    const adapterPolicyFailure = adapter?.validateDetailUrl(
      item.sourceUrl,
      source,
    );
    if (adapterPolicyFailure) {
      return;
    }
    if (buildUrlPolicyFailureReason(item.sourceUrl, source)) {
      return;
    }
    seen.add(item.sourceUrl);
    discovered.push(item);
  };

  for (const item of adapter?.extractDetailUrlsFromListHtml?.(html, listUrl) ||
    []) {
    pushDiscovered({
      publishedAt: item.publishedAt || null,
      sourceTitle: item.sourceTitle?.slice(0, 120) || null,
      sourceUrl: item.sourceUrl,
    });
  }

  for (const item of extractPublicOpportunityJsonLdUrls(html, listUrl)) {
    pushDiscovered({
      publishedAt: item.publishedAt || null,
      sourceTitle: item.sourceTitle?.slice(0, 120) || null,
      sourceUrl: item.sourceUrl,
    });
  }

  const anchorPattern =
    /<a(?:\s[^>]*)?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const sourceUrl = normalizeDiscoveredUrl(match[1] || '', listUrl);
    if (!sourceUrl) {
      continue;
    }
    pushDiscovered({
      sourceTitle: stripHtml(match[2] || '').slice(0, 120) || null,
      sourceUrl,
    });
  }

  for (const sourceUrl of extractPublicOpportunityEmbeddedUrlCandidates(
    html,
    listUrl,
  )) {
    pushDiscovered({
      sourceTitle: null,
      sourceUrl,
    });
  }

  return discovered;
}

function isSameOriginUrl(left: string, right: string) {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

function extractPublicOpportunityListUrls(
  html: string,
  listUrl: string,
  adapter: NonNullable<ReturnType<typeof getPublicCrawlerAdapter>>,
) {
  const discovered: string[] = [];
  const seen = new Set<string>();
  const shouldQueueEveryAllowedListUrl =
    adapter.sourceCode === 'PUBLIC_DEMAND_99CFW_GD' ||
    adapter.sourceCode === 'PUBLIC_OPPORTUNITY_99CFW';
  const pushListUrl = (rawUrl: string) => {
    const sourceUrl = normalizeDiscoveredUrl(rawUrl, listUrl);
    if (
      !sourceUrl ||
      seen.has(sourceUrl) ||
      sourceUrl === listUrl ||
      !isSameOriginUrl(sourceUrl, listUrl) ||
      adapter.validateListUrl(sourceUrl)
    ) {
      return;
    }
    seen.add(sourceUrl);
    discovered.push(sourceUrl);
  };

  const anchorPattern = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  for (const [anchorHtml] of html.matchAll(anchorPattern)) {
    const href = anchorHtml.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) {
      continue;
    }
    const label = stripHtml(anchorHtml);
    const normalizedHref = normalizeDiscoveredUrl(href, listUrl);
    if (
      (shouldQueueEveryAllowedListUrl &&
        !adapter.validateListUrl(normalizedHref || '')) ||
      /下一页|下页|尾页|末页|更多|加载更多|next|pager|page/i.test(
        `${anchorHtml} ${label}`,
      ) ||
      /^\d{1,4}$/.test(label) ||
      /(?:page|p|pn|currentPage)=\d+/i.test(href) ||
      /[/_.-]p?\d+\/?$/i.test(href)
    ) {
      pushListUrl(href);
    }
  }

  for (const sourceUrl of extractPublicOpportunityEmbeddedUrlCandidates(
    html,
    listUrl,
  )) {
    try {
      const source = new URL(sourceUrl);
      const current = new URL(listUrl);
      if (
        source.origin === current.origin &&
        (source.pathname === current.pathname ||
          source.pathname.startsWith(current.pathname))
      ) {
        pushListUrl(sourceUrl);
      }
    } catch {
      // Ignore malformed embedded values.
    }
  }

  return discovered;
}

async function discoverPublicOpportunityUrlsFromLists(params: {
  initialListUrls: string[];
  maxListPages: number;
  maxRetryCount: number;
  source: {
    allowedPathsJson?: null | string[];
    blockedPathsJson?: null | string[];
    rateLimitPerMinute?: number;
    sourceCode?: string;
    sourceId: number;
  };
  taskId: number;
  throttleDelayMs?: number;
}) {
  const adapter = getPublicCrawlerAdapter(params.source.sourceCode || '');
  const discoveryResult = createEmptyPublicListDiscoveryResult(
    params.initialListUrls.length,
  );
  if (!adapter) {
    return discoveryResult;
  }

  const queuedListUrls = [...params.initialListUrls];
  const visitedListUrls = new Set<string>();
  const throttleDelayMs =
    params.throttleDelayMs === undefined
      ? resolveRateLimitDelayMs(params.source.rateLimitPerMinute || 60)
      : Math.max(0, Math.floor(Number(params.throttleDelayMs) || 0));
  let lastListFetchStartedAt = 0;

  while (
    queuedListUrls.length > 0 &&
    visitedListUrls.size < params.maxListPages
  ) {
    const listUrl = queuedListUrls.shift() as string;
    if (visitedListUrls.has(listUrl)) {
      continue;
    }
    visitedListUrls.add(listUrl);
    discoveryResult.visitedListUrlCount = visitedListUrls.size;
    const listPolicyFailureReason = adapter.validateListUrl(listUrl);
    if (listPolicyFailureReason) {
      discoveryResult.policySkippedListCount += 1;
      await appendCrawlerTaskLog({
        detail: { listPolicyFailureReason, listUrl },
        level: 'WARN',
        message: 'public opportunity list URL skipped by policy',
        stage: 'DISCOVER',
        taskId: params.taskId,
      });
      continue;
    }
    try {
      const elapsedSinceLastFetch = Date.now() - lastListFetchStartedAt;
      if (
        lastListFetchStartedAt > 0 &&
        elapsedSinceLastFetch < throttleDelayMs
      ) {
        await sleep(throttleDelayMs - elapsedSinceLastFetch);
      }
      lastListFetchStartedAt = Date.now();
      const listFetchResult = await fetchPublicPage(listUrl);
      discoveryResult.fetchedListCount += 1;
      const pageTitle = extractHtmlTitle(listFetchResult.bodyHtml);
      const contentSignals = buildListPageContentSignals(
        listFetchResult.bodyText,
      );
      if (!listFetchResult.ok) {
        discoveryResult.nonOkListFetchCount += 1;
        if (discoveryResult.nonOkSamples.length < 5) {
          discoveryResult.nonOkSamples.push({
            finalUrl: listFetchResult.finalUrl,
            httpStatus: listFetchResult.httpStatus,
            listUrl,
            responseHash: listFetchResult.responseHash,
          });
        }
      }
      await appendCrawlerTaskLog({
        detail: {
          bodyTextLength: listFetchResult.bodyText.length,
          contentLength: listFetchResult.contentLength,
          contentSignals,
          contentType: listFetchResult.contentType,
          finalUrl: listFetchResult.finalUrl,
          fetchedListCount: discoveryResult.fetchedListCount,
          httpStatus: listFetchResult.httpStatus,
          listUrl,
          responseHash: listFetchResult.responseHash,
          title: pageTitle,
        },
        level: listFetchResult.ok ? 'INFO' : 'WARN',
        message: 'public opportunity list page fetched',
        stage: 'DISCOVER',
        taskId: params.taskId,
      });
      if (!listFetchResult.ok) {
        continue;
      }

      const discoveredUrls = extractPublicOpportunityDetailUrls(
        listFetchResult.bodyHtml,
        listUrl,
        params.source,
      );
      const nextListUrls = extractPublicOpportunityListUrls(
        listFetchResult.bodyHtml,
        listUrl,
        adapter,
      );
      const contentIssue = resolveListPageContentIssue({
        bodyText: listFetchResult.bodyText,
        discoveredDetailCount: discoveredUrls.length,
        discoveredListCount: nextListUrls.length,
        signals: contentSignals,
      });
      const emptyDiscoveryIssue =
        contentIssue ||
        (discoveredUrls.length <= 0 && nextListUrls.length <= 0
          ? 'NO_DETAIL_URLS'
          : null);
      if (emptyDiscoveryIssue) {
        discoveryResult.contentIssueCount += 1;
        pushListDiscoveryContentIssue(discoveryResult.contentIssueSamples, {
          finalUrl: listFetchResult.finalUrl,
          httpStatus: listFetchResult.httpStatus,
          issueCode: emptyDiscoveryIssue,
          listUrl,
          responseHash: listFetchResult.responseHash,
          signals: contentSignals,
          textSample: listFetchResult.bodyText.slice(0, 500) || null,
          title: pageTitle,
        });
      }
      discoveryResult.discoveredDetailCount += discoveredUrls.length;
      const discoverSeedResult = await seedCrawlerTaskItems(
        discoveredUrls.map((item) => ({
          maxRetryCount: params.maxRetryCount,
          publishedAt: item.publishedAt || null,
          sourceId: params.source.sourceId,
          sourceRefId: null,
          sourceRefType: 'public_list_discovery',
          sourceUrl: item.sourceUrl,
        })),
      );
      discoveryResult.discoveredListCount += nextListUrls.length;
      discoveryResult.seedCreatedCount += discoverSeedResult.createdCount;
      discoveryResult.seedUpdatedCount += discoverSeedResult.updatedCount;
      for (const nextListUrl of nextListUrls) {
        if (
          !visitedListUrls.has(nextListUrl) &&
          !queuedListUrls.includes(nextListUrl)
        ) {
          queuedListUrls.push(nextListUrl);
        }
      }
      await appendCrawlerTaskLog({
        detail: {
          discoveredCount: discoveredUrls.length,
          discoveredDetailCount: discoveryResult.discoveredDetailCount,
          discoveredListCount: nextListUrls.length,
          listContentIssue: emptyDiscoveryIssue,
          queuedListCount: queuedListUrls.length,
          sampleUrls: discoveredUrls.slice(0, 5),
          seedCreatedCount: discoverSeedResult.createdCount,
          seedCreatedTotal: discoveryResult.seedCreatedCount,
          seedUpdatedCount: discoverSeedResult.updatedCount,
          seedUpdatedTotal: discoveryResult.seedUpdatedCount,
        },
        level: 'INFO',
        message: 'public opportunity list URLs discovered and queued',
        stage: 'DISCOVER',
        taskId: params.taskId,
      });
    } catch (error) {
      const errorDetail = buildFetchErrorDetail(error);
      discoveryResult.failedListFetchCount += 1;
      if (discoveryResult.fetchErrorSamples.length < 5) {
        discoveryResult.fetchErrorSamples.push({
          errorMessage: errorDetail.errorMessage,
          errorName: errorDetail.errorName,
          listUrl,
        });
      }
      await appendCrawlerTaskLog({
        detail: { ...errorDetail, listUrl },
        level: 'ERROR',
        message: 'public opportunity list discovery failed',
        stage: 'DISCOVER',
        taskId: params.taskId,
      });
    }
  }
  return discoveryResult;
}

function buildFetchErrorDetail(error: unknown) {
  if (!(error instanceof Error)) {
    return { errorMessage: String(error) };
  }
  const cause = error.cause;
  let normalizedCause: unknown = null;
  if (cause instanceof Error) {
    normalizedCause = {
      message: cause.message,
      name: cause.name,
    };
  } else if (cause) {
    normalizedCause = String(cause);
  }
  return {
    cause: normalizedCause,
    errorMessage: error.message,
    errorName: error.name,
  };
}

async function fetchPublicPage(sourceUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const sourceOrigin = new URL(sourceUrl).origin;
    const response = await fetch(sourceUrl, {
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Referer: sourceOrigin,
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': PUBLIC_CRAWLER_USER_AGENT,
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await withTimeout(
      () => response.text(),
      RESPONSE_TEXT_TIMEOUT_MS,
      'RESPONSE_TEXT_TIMEOUT',
    );
    return {
      bodyHtml: text,
      bodyText: stripHtml(text),
      contentLength: text.length,
      contentType: response.headers.get('content-type'),
      finalUrl: response.url,
      httpStatus: response.status,
      ok: response.ok,
      responseHash: createHash('sha256').update(text).digest('hex'),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function decodeUnicodeEscapes(value: string) {
  return value.replaceAll(/\\u([\da-f]{4})/gi, (_, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16)),
  );
}

function extractFirstMatch(
  text: string,
  patterns: RegExp[],
  normalizer: (value: string) => string = (value) => value.trim(),
) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    pattern.lastIndex = 0;
    const value = match?.[1] ? normalizer(match[1]) : '';
    if (value) {
      return value;
    }
  }
  return null;
}

function extractPageTitle(html: string, bodyText: string) {
  const h1Titles = [...html.matchAll(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/gi)]
    .map((match) => stripHtml(match[1] || ''))
    .map((title) => normalizeExtractedTitle(title))
    .filter(Boolean);
  const detailTitle =
    h1Titles.find((title) => !/久久厂房网|厂房仓库租赁平台/.test(title)) ||
    h1Titles[0];
  if (detailTitle) {
    return detailTitle;
  }
  const title = extractFirstMatch(html, [
    /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i,
  ]);
  const normalizedTitle = normalizeExtractedTitle(title || '');
  return normalizedTitle || bodyText.split(/\s+/).slice(0, 18).join(' ');
}

function normalizeExtractedTitle(title: string) {
  return stripHtml(title)
    .replace(/[-_丨|].*99cfw.*$/i, '')
    .replace(/[-_丨|].*久久厂房网.*$/, '')
    .trim();
}

function buildShanghaiIsoDate(params: {
  day: number;
  hour?: number;
  minute?: number;
  month: number;
  second?: number;
  year: number;
}) {
  const date = new Date(
    `${params.year}-${String(params.month).padStart(2, '0')}-${String(
      params.day,
    ).padStart(2, '0')}T${String(params.hour || 0).padStart(2, '0')}:${String(
      params.minute || 0,
    ).padStart(2, '0')}:${String(params.second || 0).padStart(2, '0')}+08:00`,
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function decodeNumericHtmlEntities(value: string) {
  return value
    .replaceAll(/&#x([\da-f]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    );
}

function normalizeCrawlerText(value: null | string | undefined) {
  return decodeNumericHtmlEntities(String(value || ''))
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function stringifyCrawlerJson(value: unknown) {
  try {
    return JSON.stringify(value, (_key, item) =>
      typeof item === 'bigint' ? item.toString() : item,
    );
  } catch {
    return String(value ?? '');
  }
}

function inferCityFromUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const haystack = `${url.hostname}${url.pathname}`.toLowerCase();
    if (
      url.hostname.startsWith('gd.') ||
      url.hostname.startsWith('guangdong.') ||
      haystack.includes('guangdong') ||
      haystack.includes('/gd/')
    ) {
      return GUANGDONG_PROVINCE_TEXT;
    }
    if (url.hostname.startsWith('sz.') || haystack.includes('shenzhen')) {
      return SHENZHEN_CITY_NAME;
    }
    if (url.hostname.startsWith('dg.') || haystack.includes('dongguan')) {
      return '东莞';
    }
    if (url.hostname.startsWith('gz.') || haystack.includes('guangzhou')) {
      return '广州';
    }
    if (url.hostname.startsWith('fs.') || haystack.includes('foshan')) {
      return '佛山';
    }
    if (url.hostname.startsWith('zs.') || haystack.includes('zhongshan')) {
      return '中山';
    }
    if (url.hostname.startsWith('zh.') || haystack.includes('zhuhai')) {
      return '珠海';
    }
    if (url.hostname.startsWith('jm.') || haystack.includes('jiangmen')) {
      return '江门';
    }
    if (url.hostname.startsWith('zq.') || haystack.includes('zhaoqing')) {
      return '肇庆';
    }
    if (haystack.includes('huizhou')) {
      return '惠州';
    }
  } catch {
    // Ignore invalid URL, caller already records the raw URL.
  }
  return null;
}

function inferCityFromTextOrUrl(
  text: string,
  title: string,
  sourceUrl: string,
) {
  return (
    resolveGuangdongCityFromText(`${title} ${text}`) ||
    normalizeGuangdongCity(inferCityFromUrl(sourceUrl)) ||
    (/广东|guangdong/i.test(`${title} ${text} ${sourceUrl}`)
      ? GUANGDONG_PROVINCE_TEXT
      : null)
  );
}

function extractAnyAreaTextFromText(text: string) {
  return extractFirstMatch(text, [
    /(?:意向面积|需求面积|厂房面积|建筑面积|规划面积|建成面积|面积)[：:\s]*([0-9.,]+(?:\s*[~\-至到]\s*[0-9.,]+)?\s*(?:万\s*)?(?:㎡|平方米|平米|平方|m2|亩))/i,
    /([0-9.,]+(?:\s*[~\-至到]\s*[0-9.,]+)?\s*(?:万\s*)?(?:㎡|平方米|平米|平方|m2|亩))/i,
  ]);
}

function extractAnyPriceTextFromText(text: string) {
  return extractFirstMatch(text, [
    /(?:意向租金|租金|价格|单价|土地均价|投资预计|投资额|预算)[：:\s]*([0-9.,]+(?:\s*万|\s*亿)?\s*(?:元|万元|亿元)?(?:\/(?:[㎡月天亩]|平方米|平米))?)/,
    /([0-9.,]+(?:\s*万|\s*亿)?\s*(?:元|万元|亿元)(?:\/(?:[㎡月天亩]|平方米|平米))?)/,
  ]);
}

function getShanghaiDateParts(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear(),
  };
}

function buildRelativeDayIso(
  dayOffset: number,
  timeText?: null | string,
  crawledAt = new Date(),
) {
  const base = new Date(crawledAt.getTime() - dayOffset * 24 * 60 * 60 * 1000);
  const parts = getShanghaiDateParts(base);
  const timeMatch = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(
    String(timeText || '').trim(),
  );
  return buildShanghaiIsoDate({
    ...parts,
    hour: timeMatch ? Number(timeMatch[1]) : 0,
    minute: timeMatch ? Number(timeMatch[2]) : 0,
    second: timeMatch?.[3] ? Number(timeMatch[3]) : 0,
  });
}

function extractPriceTextFromText(text: string) {
  return extractFirstMatch(text, [
    /(?:租金|价格|单价)[：:\s]*([0-9.,]+\s*(?:元|块|RMB)?\s*\/?\s*(?:㎡|平米|平方|m2)?\s*\/?\s*(?:月|天)?)/i,
  ]);
}

function extractContactNameFromText(text: string) {
  return extractFirstMatch(text, [
    /(?:联系人|联系 人|联 系 人)[：:\s]*([\u4E00-\u9FA5a-z]{2,12})/i,
  ]);
}

function normalizeRegionPart(value?: null | string) {
  const normalized = String(value || '')
    .replaceAll(/\s+/g, '')
    .trim();
  if (
    !normalized ||
    ['不限', '其他', '切换城市', '区域', '当前城市', '首页'].includes(
      normalized,
    ) ||
    /求购|求租|范围|附近|周边|需求|诚购|急购/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function inferRegionFromCfzsw68Url(sourceUrl: string) {
  try {
    const pathname = new URL(sourceUrl).pathname;
    if (pathname.startsWith('/sz/')) {
      return { city: SHENZHEN_CITY_NAME, district: null };
    }
  } catch {
    // ignore invalid URL, caller already records the raw URL
  }
  return { city: null, district: null };
}

function extractIndustryTextFromText(text: string) {
  return extractFirstMatch(text, [
    /(?:行业|所属行业|产业类型)[：:\s]*([\u4E00-\u9FA5a-z0-9、/]{2,40})/i,
  ]);
}

function extractCompanyNameFromText(text: string) {
  return extractFirstMatch(text, [
    /(?:公司名称|公司名|企业名称|企业名|单位名称|需求企业|需求方|承租企业|承租方|求租企业|求租方|联系人单位)[：:\s]*([\u4E00-\u9FA5A-Z0-9（）()]{2,80}(?:股份有限公司|有限责任公司|有限公司|集团有限公司|集团|工厂|厂))/i,
  ]);
}

function extractStrictRelativePublishedAt(
  value: string,
  crawledAt = new Date(),
) {
  if (/\u521A\u521A|\u521A\u53D1\u5E03/.test(value)) {
    return crawledAt.toISOString();
  }
  const minuteAgo = /(\d{1,4})\s*\u5206\u949F\u524D/.exec(value);
  if (minuteAgo?.[1]) {
    return new Date(
      crawledAt.getTime() - Number(minuteAgo[1]) * 60 * 1000,
    ).toISOString();
  }
  const hourAgo = /(\d{1,4})\s*\u5C0F\u65F6\u524D/.exec(value);
  if (hourAgo?.[1]) {
    return new Date(
      crawledAt.getTime() - Number(hourAgo[1]) * 60 * 60 * 1000,
    ).toISOString();
  }
  const dayAgo = /(\d{1,4})\s*\u5929\u524D/.exec(value);
  if (dayAgo?.[1]) {
    return new Date(
      crawledAt.getTime() - Number(dayAgo[1]) * 24 * 60 * 60 * 1000,
    ).toISOString();
  }
  const today = /\u4ECA\u5929\s*(\d{1,2}:\d{1,2}(?::\d{1,2})?)?/.exec(value);
  if (today?.[0]) {
    return buildRelativeDayIso(0, today[1], crawledAt);
  }
  const yesterday = /\u6628\u5929\s*(\d{1,2}:\d{1,2}(?::\d{1,2})?)?/.exec(
    value,
  );
  if (yesterday?.[0]) {
    return buildRelativeDayIso(1, yesterday[1], crawledAt);
  }
  const beforeYesterday = /\u524D\u5929\s*(\d{1,2}:\d{1,2}(?::\d{1,2})?)?/.exec(
    value,
  );
  if (beforeYesterday?.[0]) {
    return buildRelativeDayIso(2, beforeYesterday[1], crawledAt);
  }
  return null;
}

function extractStrictPublishedAtFromText(
  text: string,
  crawledAt = new Date(),
) {
  const value = extractFirstMatch(text, [
    /(?:\u66F4\u65B0\u65F6\u95F4|\u66F4\u65B0\u65E5\u671F|\u53D1\u5E03\u65F6\u95F4|\u53D1\u5E03\u65E5\u671F|\u53D1\u5E03\u4E8E)[\uFF1A:\s]*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:[T\s]\d{1,2}:\d{1,2}(?::\d{1,2})?)?)/,
    /(?:\u66F4\u65B0\u65F6\u95F4|\u66F4\u65B0\u65E5\u671F|\u53D1\u5E03\u65F6\u95F4|\u53D1\u5E03\u65E5\u671F|\u53D1\u5E03\u4E8E)[\uFF1A:\s]*(\u521A\u521A|\u521A\u53D1\u5E03|\d{1,4}\s*\u5206\u949F\u524D|\d{1,4}\s*\u5C0F\u65F6\u524D|\d{1,4}\s*\u5929\u524D|\u4ECA\u5929\s*\d{0,2}:?\d{0,2}:?\d{0,2}|\u6628\u5929\s*\d{0,2}:?\d{0,2}:?\d{0,2}|\u524D\u5929\s*\d{0,2}:?\d{0,2}:?\d{0,2})/,
  ]);
  if (!value) {
    return null;
  }
  return (
    normalizePublishedAtText(value) ||
    extractStrictRelativePublishedAt(value, crawledAt)
  );
}

function extractPublishedAtFromHtml(
  html: string,
  text: string,
  crawledAt: Date,
) {
  const metaDate = extractFirstMatch(html, [
    /(?:datetime|content)=["']([^"']{0,120})["']/i,
  ]);
  return (
    normalizePublishedAtText(metaDate) ||
    extractStrictPublishedAtFromText(text, crawledAt) ||
    normalizePublishedAtText(
      extractFirstMatch(text, [
        /(?:发布日期|发布时间|更新时间|发布于|更新于)[：:\s]*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?)/,
        /(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?)/,
      ]),
    ) ||
    extractStrictRelativePublishedAt(text, crawledAt)
  );
}

function extractStrictAreaTextFromText(text: string) {
  return extractFirstMatch(text, [
    /(?:\u9762\u79EF\u9700\u6C42|\u9700\u6C42\u9762\u79EF|\u5382\u623F\u9762\u79EF|\u5EFA\u7B51\u9762\u79EF)[\uFF1A:\s]*([0-9.,，~～\-−－\u5230\u81F3]+\s*(?:\u33A1|\u5E73\u65B9\u7C73|\u5E73\u7C73|m2|\u4EA9))/i,
  ]);
}

function extractStrictPhoneNumberFromText(text: string) {
  return extractFirstMatch(text, [
    /(?:\u8054\u7CFB\u7535\u8BDD|\u7535\u8BDD|\u624B\u673A)[\uFF1A:\s]*(1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})/,
  ]);
}

function extractStrictRegionFromText(text: string) {
  const regionText = extractFirstMatch(text, [
    /\u610F\u5411\u533A\u57DF[\uFF1A:\s]*([^：]{2,120}?)(?:\u529F\u80FD\u7528\u9014|\u9762\u79EF\u9700\u6C42|\u5EFA\u7B51\u53C2\u6570|\u8BE6\u60C5\u63CF\u8FF0|\u8054\u7CFB\u65B9\u5F0F)/,
  ]);
  if (regionText) {
    const parts = regionText
      .split(/[-－]/)
      .map((part) => normalizeRegionPart(part))
      .filter(Boolean) as string[];
    if (parts.length >= 3) {
      return { city: parts[1] || null, district: parts[2] || null };
    }
    if (parts.length === 2) {
      if (/[省市自治区]$/.test(parts[0] || '')) {
        return { city: parts[1] || null, district: null };
      }
      return { city: parts[0] || null, district: parts[1] || null };
    }
    return { city: parts[0] || null, district: null };
  }

  const city = extractFirstMatch(text, [
    /(?:\u57CE\u5E02|\u6240\u5728\u5730|\u5730\u533A|\u533A\u57DF)[\uFF1A:\s]*([\u4E00-\u9FA5]{2,20}[市州盟]?)/,
  ]);
  return {
    city: normalizeRegionPart(city),
    district: null,
  };
}

function buildSyntheticPublicOpportunityRowFromFetchedPage(params: {
  bodyHtml?: string;
  bodyText: string;
  crawledAt?: Date;
  opportunityType?: 'DEMAND' | 'SUPPLY';
  sourceCode: string;
  sourceName: string;
  sourceSite?: string;
  sourceUrl: string;
}): { parseMeta: SyntheticOpportunityParseMeta; row: PublicOpportunityRow } {
  const bodyHtml = params.bodyHtml || '';
  const decodedBodyText = decodeUnicodeEscapes(params.bodyText);
  const decodedBodyHtml = decodeUnicodeEscapes(bodyHtml);
  const title = extractPageTitle(decodedBodyHtml, decodedBodyText);
  const companyName = extractCompanyNameFromText(decodedBodyText);
  const crawledAt = params.crawledAt || new Date();
  const publishedAt = extractPublishedAtFromHtml(
    decodedBodyHtml,
    decodedBodyText,
    crawledAt,
  );
  const region = extractStrictRegionFromText(decodedBodyText);
  const areaText =
    extractStrictAreaTextFromText(decodedBodyText) ||
    extractAnyAreaTextFromText(`${title} ${decodedBodyText}`);
  const contactName = extractContactNameFromText(decodedBodyText);
  const phoneNumber = extractStrictPhoneNumberFromText(decodedBodyText);
  const priceText =
    extractPriceTextFromText(decodedBodyText) ||
    extractAnyPriceTextFromText(`${title} ${decodedBodyText}`);
  const industryText = extractIndustryTextFromText(decodedBodyText);
  const fallbackRegion = inferRegionFromCfzsw68Url(params.sourceUrl);
  const city =
    region.city ||
    fallbackRegion.city ||
    inferCityFromTextOrUrl(decodedBodyText, title, params.sourceUrl);
  const district =
    region.district ||
    fallbackRegion.district ||
    (city ? null : resolveGuangdongCityFromText(decodedBodyText));
  const opportunityType = isDemandLikeSource(
    params.sourceCode,
    params.sourceUrl,
    `${title} ${decodedBodyText}`,
  )
    ? 'DEMAND'
    : params.opportunityType || 'DEMAND';
  const parseMeta = {
    areaText,
    city,
    companyName,
    contactName,
    district,
    industryText,
    phoneNumber,
    priceText,
    publishedAt,
    strictCity: region.city,
    strictDistrict: region.district,
    title,
    urlInferredCity: fallbackRegion.city,
    urlInferredDistrict: fallbackRegion.district,
  };
  return {
    parseMeta,
    row: {
      areaText,
      city,
      contactName,
      description: decodedBodyText,
      detailJson: {
        companyName,
        crawledFrom: 'public_opportunity_url_crawler',
        crawlerSourceCode: params.sourceCode,
        crawlerSourceName: params.sourceName,
        sourceUrl: params.sourceUrl,
      },
      district,
      industryText,
      opportunityId: 0,
      opportunityType,
      phoneNumber,
      priceText,
      publishedAt,
      sourceSite: params.sourceSite || params.sourceName,
      sourceUrl: params.sourceUrl,
      tagsJson: null,
      title: title || params.sourceUrl,
    },
  };
}

function isDemandLikeSource(
  sourceCode: string,
  sourceUrl: string,
  text: string,
) {
  if (sourceCode.includes('DEMAND')) {
    return true;
  }
  return (
    /\/xuqiu_\d+\.(?:html|htm)$/i.test(sourceUrl) ||
    /求租|求购|需求|意向类型|意向面积|意向区域/.test(text)
  );
}

function applyPlatformParseFallbacks(params: {
  parseMeta: SyntheticOpportunityParseMeta;
  row: PublicOpportunityRow;
  sourceCode: string;
  sourceUrl: string;
}) {
  const { parseMeta, row, sourceCode, sourceUrl } = params;
  const detailJson =
    row.detailJson && typeof row.detailJson === 'object'
      ? (row.detailJson as Record<string, unknown>)
      : {};
  const text = normalizeCrawlerText(
    [row.title, row.description, stringifyCrawlerJson(detailJson)].join(' '),
  );
  const title = normalizeCrawlerText(row.title || parseMeta.title || sourceUrl);
  const city =
    row.city ||
    parseMeta.city ||
    inferCityFromTextOrUrl(text, title, sourceUrl);
  const normalizedCity = city ? normalizeGuangdongCity(city) || city : null;
  const district =
    row.district ||
    parseMeta.district ||
    (normalizedCity ? null : resolveGuangdongCityFromText(text));
  const areaText =
    row.areaText ||
    parseMeta.areaText ||
    extractAnyAreaTextFromText(`${title} ${text}`);
  const priceText =
    row.priceText ||
    parseMeta.priceText ||
    extractAnyPriceTextFromText(`${title} ${text}`);
  const publishedAt =
    row.publishedAt ||
    parseMeta.publishedAt ||
    extractPublishedAtFromHtml('', text, new Date());
  const opportunityType = isDemandLikeSource(sourceCode, sourceUrl, text)
    ? 'DEMAND'
    : row.opportunityType;

  return {
    parseMeta: {
      ...parseMeta,
      areaText: parseMeta.areaText || areaText || null,
      city: parseMeta.city || normalizedCity || null,
      district: parseMeta.district || district || null,
      priceText: parseMeta.priceText || priceText || null,
      publishedAt: parseMeta.publishedAt || publishedAt || null,
    },
    row: {
      ...row,
      areaText: areaText || null,
      city: normalizedCity || null,
      district: district || null,
      opportunityType,
      priceText: priceText || null,
      publishedAt: publishedAt || null,
    },
  };
}

async function upsertFetchedPublicOpportunity(
  params: OpportunityUpsertPayload,
) {
  const { parseMeta, row, sourceUrl } = params;
  const opportunityType =
    row.opportunityType === 'SUPPLY' ? 'SUPPLY' : 'DEMAND';
  const useStrictParsedOnly =
    row.opportunityType === 'SUPPLY' && Number(row.opportunityId || 0) > 0;
  return upsertCrawlerPublicOpportunity({
    areaText: useStrictParsedOnly
      ? parseMeta?.areaText || null
      : row.areaText || parseMeta?.areaText || null,
    city: useStrictParsedOnly
      ? parseMeta?.city || null
      : row.city || parseMeta?.city || null,
    contactName: useStrictParsedOnly
      ? parseMeta?.contactName || null
      : row.contactName || parseMeta?.contactName || null,
    description: row.description || null,
    detailJson: {
      ...(row.detailJson &&
      typeof row.detailJson === 'object' &&
      !Array.isArray(row.detailJson)
        ? row.detailJson
        : {}),
      crawlerSourceCode: params.sourceCode,
      crawlerSourceName: params.sourceName,
      extractionPolicy: 'STRICT_DETAIL_PAGE_LABELS_ONLY',
      parseMeta: parseMeta || null,
      responseHash: params.responseHash || null,
      sourceOpportunityId: row.opportunityId || null,
    },
    district: useStrictParsedOnly
      ? parseMeta?.district || null
      : row.district || parseMeta?.district || null,
    industryText: useStrictParsedOnly
      ? parseMeta?.industryText || null
      : row.industryText || parseMeta?.industryText || null,
    opportunityType,
    phoneNumber: useStrictParsedOnly
      ? parseMeta?.phoneNumber || null
      : row.phoneNumber || parseMeta?.phoneNumber || null,
    priceText: useStrictParsedOnly
      ? parseMeta?.priceText || null
      : row.priceText || parseMeta?.priceText || null,
    publishedAt: parseMeta?.publishedAt || row.publishedAt || null,
    score: opportunityType === 'SUPPLY' ? 70 : 75,
    sourceSite: row.sourceSite || null,
    sourceTable:
      opportunityType === 'DEMAND'
        ? 'investment_public_demand'
        : 'investment_public_opportunity',
    sourceUrl: row.sourceUrl || sourceUrl,
    tagsJson: ['crawler', opportunityType, params.sourceCode],
    title: row.title || parseMeta?.title || sourceUrl,
  });
}

function isEffectiveCrawlerUpsert(
  upsertResult: Awaited<ReturnType<typeof upsertCrawlerPublicOpportunity>>,
) {
  const status =
    upsertResult.qualityResult?.status ||
    String(upsertResult.opportunity?.opportunityStatus || '');
  return status === 'EFFECTIVE' || status === 'VERIFIED';
}

function buildQualitySkipReason(error: PublicOpportunityQualitySkipError) {
  const reasons = error.qualityResult.reasons.filter(Boolean);
  return [error.skipReason, ...reasons].join(':').slice(0, 255);
}

function buildPublicOpportunityInputFromAdapterExtract(params: {
  opportunity: ParsedPublicOpportunity;
  responseHash: string;
  sourceCode: string;
  sourceName: string;
  sourceUrl: string;
}): PublicOpportunityCrawlerInput {
  const detailJson =
    params.opportunity.detailJson &&
    typeof params.opportunity.detailJson === 'object' &&
    !Array.isArray(params.opportunity.detailJson)
      ? params.opportunity.detailJson
      : {};
  return {
    areaText: params.opportunity.areaText,
    city: params.opportunity.city,
    contactName: params.opportunity.contactName,
    description: params.opportunity.description,
    detailJson: {
      ...detailJson,
      crawlerSourceCode: params.sourceCode,
      crawlerSourceName: params.sourceName,
      responseHash: params.responseHash,
      sourceUrl: params.sourceUrl,
    },
    district: params.opportunity.district,
    industryText: params.opportunity.industryText,
    opportunityType: params.opportunity.opportunityType,
    phoneNumber: params.opportunity.phoneNumber,
    priceText: params.opportunity.priceText,
    publishedAt: params.opportunity.publishedAt,
    publishedDateText: params.opportunity.publishedDateText,
    score: params.opportunity.opportunityType === 'SUPPLY' ? 70 : 75,
    sourceSite: params.opportunity.sourceSite || params.sourceName,
    sourceTable: 'public_platform_adapter',
    sourceUrl: params.opportunity.sourceUrl || params.sourceUrl,
    tagsJson: [
      'crawler',
      params.opportunity.opportunityType,
      params.sourceCode,
    ],
    title: params.opportunity.title || params.sourceUrl,
  };
}

function extractAdapterParsedPublicOpportunity(params: {
  adapter: NonNullable<ReturnType<typeof getPublicCrawlerAdapter>>;
  bodyHtml: string;
  crawledAt: Date;
  sourceUrl: string;
}) {
  if (!params.adapter.extractFromHtml) {
    return null;
  }
  return params.adapter.extractFromHtml(
    params.bodyHtml,
    params.sourceUrl,
    params.crawledAt,
  );
}

function buildParseMetaFromParsedOpportunity(
  opportunity: ParsedPublicOpportunity,
): SyntheticOpportunityParseMeta {
  return {
    areaText: opportunity.areaText,
    city: opportunity.city,
    contactName: opportunity.contactName,
    district: opportunity.district,
    industryText: opportunity.industryText,
    phoneNumber: opportunity.phoneNumber,
    priceText: opportunity.priceText,
    publishedAt: opportunity.publishedAt,
    strictCity: opportunity.city,
    strictDistrict: opportunity.district,
    title: opportunity.title,
  };
}

export async function runPublicOpportunityUrlCrawlerTask(
  optionsInput: PublicOpportunityCrawlerRunOptions = {},
): Promise<CrawlerTask> {
  const options = normalizeOptions(optionsInput);
  const sourceCode =
    String(optionsInput.sourceCode || '').trim() ||
    PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE;
  let source;
  if (sourceCode === PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE) {
    source = await getPublicFactoryListingCrawlerSource();
  } else if (sourceCode === PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE) {
    source = await getPublicOpportunityCrawlerSource();
  } else {
    source = await getPublicCrawlerSourceByCode(sourceCode);
  }
  if (!source) {
    throw new Error('PUBLIC_OPPORTUNITY crawler source not found');
  }
  const adapter = getPublicCrawlerAdapter(source.sourceCode);
  if (!adapter) {
    throw new CrawlerTaskValidationError('SOURCE_ADAPTER_NOT_FOUND');
  }
  const opportunityType = adapter.opportunityType;
  const precheckAt = new Date();
  const sourcePolicy = checkCrawlerSourcePolicy(source);
  if (!sourcePolicy.allowed) {
    throw new CrawlerTaskValidationError(
      sourcePolicy.reason || 'SOURCE_POLICY_REJECTED',
    );
  }
  if (!options.ignoreInterval) {
    const intervalPolicy = checkCrawlerIntervalPolicy(source, precheckAt);
    if (!intervalPolicy.allowed) {
      throw new CrawlerTaskValidationError(
        intervalPolicy.reason || 'CRAWL_INTERVAL_NOT_REACHED',
      );
    }
  }

  const taskId = await createCrawlerTask({
    requestConfig: {
      batchSize: options.batchSize,
      freshnessDays: options.freshnessDays,
      ignoreInterval: options.ignoreInterval,
      maxRetryCount: options.maxRetryCount,
      reprocessSuccess: options.reprocessSuccess,
      retryDelayMinutes: options.retryDelayMinutes,
      staleReprocessMinutes: options.staleReprocessMinutes,
      sourceCode: source.sourceCode,
    },
    sourceId: source.sourceId,
    taskType: 'PUBLIC_OPPORTUNITY_URL_BATCH',
  });
  const startedAt = new Date();
  const staleReprocessAfter = new Date(
    startedAt.getTime() - options.staleReprocessMinutes * 60 * 1000,
  );
  let createdLeadCount = 0;
  let fetchedCount = 0;
  let listDiscoveryResult = createEmptyPublicListDiscoveryResult();
  let skippedCount = 0;
  let updatedLeadCount = 0;
  let taskBudgetExceeded = false;

  await updateCrawlerTaskStatus({
    crawlStartedAt: startedAt,
    startedAt,
    status: 'RUNNING',
    taskId,
  });

  try {
    await appendCrawlerTaskLog({
      detail: {
        crawlIntervalMinutes: source.crawlIntervalMinutes,
        lastCrawledAt: source.lastCrawledAt,
        options,
        rateLimitPerMinute: source.rateLimitPerMinute,
        sourceAdapter: {
          listUrls: adapter.buildListUrls?.() || [adapter.buildListUrl()],
          opportunityType: adapter.opportunityType,
          platformName: adapter.platformName || null,
          sourceSite: adapter.sourceSite,
        },
        sourceCode: source.sourceCode,
        sourceId: source.sourceId,
      },
      level: 'INFO',
      message: 'public opportunity URL crawler source validation started',
      stage: 'SOURCE_VALIDATE',
      taskId,
    });

    await appendCrawlerTaskLog({
      detail: {
        adapterSourceCode: adapter.sourceCode,
        adapterSourceSite: adapter.sourceSite,
        listUrls: adapter.buildListUrls?.() || [adapter.buildListUrl()],
        opportunityType: adapter.opportunityType,
        parserEnabled: Boolean(adapter.extractFromHtml),
        platformName: adapter.platformName || null,
      },
      level: 'INFO',
      message: 'public crawler adapter selected',
      stage: 'ADAPTER',
      taskId,
    });

    await appendCrawlerTaskLog({
      detail: {
        allowedPathsJson: source.allowedPathsJson,
        blockedPathsJson: source.blockedPathsJson,
        robotsUrl: source.robotsUrl,
      },
      level: 'INFO',
      message: 'public crawler path strategy validated; no robots.txt fetched',
      stage: 'ROBOTS_CHECK',
      taskId,
    });

    const staleReclaimResult = await reclaimStaleRunningCrawlerTaskItems({
      sourceId: source.sourceId,
      staleMinutes: DEFAULT_STALE_RUNNING_MINUTES,
      taskId,
    });
    if (staleReclaimResult.reclaimedCount > 0) {
      await appendCrawlerTaskLog({
        detail: staleReclaimResult,
        level: 'WARN',
        message: 'stale RUNNING URL items reclaimed',
        stage: 'QUEUE',
        taskId,
      });
    }

    if (options.discoverList) {
      const listUrls = adapter.buildListUrls?.() || [adapter.buildListUrl()];
      listDiscoveryResult = await discoverPublicOpportunityUrlsFromLists({
        initialListUrls: listUrls,
        maxListPages: options.maxListPages,
        maxRetryCount: options.maxRetryCount,
        source,
        taskId,
        throttleDelayMs: Math.max(
          options.listDiscoveryDelayMs,
          resolveRateLimitDelayMs(source.rateLimitPerMinute),
        ),
      });
    }

    if (isTaskBudgetExceeded(startedAt)) {
      taskBudgetExceeded = true;
      await appendCrawlerTaskLog({
        detail: {
          budgetMs: PUBLIC_OPPORTUNITY_TASK_BUDGET_MS,
          sourceCode: source.sourceCode,
        },
        level: 'WARN',
        message:
          'public opportunity URL crawler task budget exhausted after discovery',
        stage: 'FINISH',
        taskId,
      });
    }

    const seedRowLimit = resolveSeedRowLimit(options.batchSize);
    const seedRows =
      source.sourceCode === PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE
        ? await querySeedDemandRows(seedRowLimit)
        : await querySeedRowsByType({
            limit: seedRowLimit,
            opportunityType,
            sourceSite: adapter?.sourceSite || source.sourceName,
          });
    const rejectedSeedRows = seedRows
      .map((row) => ({
        opportunityId: row.opportunityId,
        reason: row.sourceUrl
          ? buildUrlPolicyFailureReason(row.sourceUrl, source)
          : 'URL_EMPTY',
        sourceUrl: row.sourceUrl || null,
      }))
      .filter((item) => item.reason);
    const seedInputs = seedRows
      .filter(
        (row) => row.sourceUrl && isAllowedSourceUrl(row.sourceUrl, source),
      )
      .map((row) => ({
        maxRetryCount: options.maxRetryCount,
        publishedAt: row.publishedAt || null,
        sourceId: source.sourceId,
        sourceRefId: toSafeNumberId(row.opportunityId),
        sourceRefType: 'investment_public_opportunity',
        sourceUrl: String(row.sourceUrl),
      }));
    const prioritySourceRefIds = seedRows
      .map((row) => toSafeNumberId(row.opportunityId))
      .filter(Boolean);
    const seedResult = await seedCrawlerTaskItems(seedInputs);
    await appendCrawlerTaskLog({
      detail: {
        priorityItemCount: prioritySourceRefIds.length,
        rejectedSeedCount: rejectedSeedRows.length,
        rejectedSeedSamples: rejectedSeedRows.slice(0, 5),
        seedRowLimit,
        seedCreatedCount: seedResult.createdCount,
        seedUpdatedCount: seedResult.updatedCount,
        sourceRowCount: seedRows.length,
      },
      level: 'INFO',
      message: 'public opportunity URL queue seeded',
      stage: 'QUEUE',
      taskId,
    });

    const claimedItems: CrawlerTaskItem[] = [];
    const queuePolicySkipSamples: Array<{
      itemId: number;
      reason: string;
      sourceUrl: string;
    }> = [];
    let queuePolicySkippedCount = 0;
    let queueCandidateCount = 0;
    const candidates = taskBudgetExceeded
      ? []
      : await listRunnableCrawlerTaskItems({
          allowUnknownPublishedAt: true,
          limit: resolveQueueScanLimit(options.batchSize),
          prioritySourceRefIds,
          reprocessSuccess: options.reprocessSuccess,
          sourceId: source.sourceId,
          staleReprocessAfter,
        });
    queueCandidateCount = candidates.length;
    for (const item of candidates) {
      const policyFailureReason = buildUrlPolicyFailureReason(
        item.sourceUrl,
        source,
      );
      if (!policyFailureReason) {
        claimedItems.push(item);
        if (claimedItems.length >= options.batchSize) {
          break;
        }
        continue;
      }

      const claimed = await claimCrawlerTaskItem({
        itemId: item.itemId,
        reprocessSuccess: options.reprocessSuccess,
        staleReprocessAfter,
        taskId,
      });
      if (!claimed) {
        continue;
      }
      queuePolicySkippedCount += 1;
      skippedCount += 1;
      await markCrawlerTaskItemSkipped({
        itemId: item.itemId,
        reason: policyFailureReason,
        taskId,
      });
      if (queuePolicySkipSamples.length < 10) {
        queuePolicySkipSamples.push({
          itemId: item.itemId,
          reason: policyFailureReason,
          sourceUrl: item.sourceUrl,
        });
      }
      if (queuePolicySkippedCount >= MAX_QUEUE_POLICY_SKIP_COUNT) {
        break;
      }
    }
    if (queuePolicySkippedCount > 0) {
      await appendCrawlerTaskLog({
        detail: {
          candidateCount: queueCandidateCount,
          sampleItems: queuePolicySkipSamples,
          skippedCount: queuePolicySkippedCount,
        },
        level: 'WARN',
        message: 'invalid queued public URLs skipped before fetch',
        stage: 'QUEUE',
        taskId,
      });
    }
    const items = claimedItems;
    await appendCrawlerTaskLog({
      detail: {
        candidateCount: queueCandidateCount,
        itemCount: items.length,
        policySkippedCount: queuePolicySkippedCount,
        staleReprocessAfter: staleReprocessAfter.toISOString(),
      },
      level: 'INFO',
      message: 'public opportunity URL batch claimed',
      stage: 'QUEUE',
      taskId,
    });

    const rateLimitDelayMs = resolveRateLimitDelayMs(source.rateLimitPerMinute);
    let lastFetchStartedAt = 0;
    for (const item of items) {
      if (isTaskBudgetExceeded(startedAt)) {
        taskBudgetExceeded = true;
        await appendCrawlerTaskLog({
          detail: {
            budgetMs: PUBLIC_OPPORTUNITY_TASK_BUDGET_MS,
            fetchedCount,
            itemId: item.itemId,
            sourceCode: source.sourceCode,
            sourceUrl: item.sourceUrl,
          },
          level: 'WARN',
          message: 'public opportunity URL crawler task budget exhausted',
          stage: 'FINISH',
          taskId,
        });
        break;
      }
      const claimed = await claimCrawlerTaskItem({
        itemId: item.itemId,
        reprocessSuccess: options.reprocessSuccess,
        staleReprocessAfter,
        taskId,
      });
      if (!claimed) {
        await appendCrawlerTaskLog({
          detail: { itemId: item.itemId, sourceUrl: item.sourceUrl },
          level: 'WARN',
          message: 'public opportunity URL item claim skipped',
          stage: 'QUEUE',
          taskId,
        });
        continue;
      }
      const policyFailureReason = buildUrlPolicyFailureReason(
        item.sourceUrl,
        source,
      );
      if (policyFailureReason) {
        skippedCount += 1;
        await markCrawlerTaskItemSkipped({
          itemId: item.itemId,
          reason: policyFailureReason,
          taskId,
        });
        await appendCrawlerTaskLog({
          detail: {
            itemId: item.itemId,
            reason: policyFailureReason,
            sourceUrl: item.sourceUrl,
          },
          level: 'WARN',
          message: 'URL skipped by allowlist',
          stage: 'POLICY_SKIP',
          taskId,
        });
        continue;
      }

      try {
        const elapsedSinceLastFetch = Date.now() - lastFetchStartedAt;
        if (
          lastFetchStartedAt > 0 &&
          elapsedSinceLastFetch < rateLimitDelayMs
        ) {
          await sleep(rateLimitDelayMs - elapsedSinceLastFetch);
        }
        lastFetchStartedAt = Date.now();
        let fetchResult: Awaited<ReturnType<typeof fetchPublicPage>>;
        try {
          fetchResult = await fetchPublicPage(item.sourceUrl);
        } catch (error) {
          const errorDetail = buildFetchErrorDetail(error);
          await appendCrawlerTaskLog({
            detail: {
              ...errorDetail,
              itemId: item.itemId,
              reason: errorDetail.errorMessage,
              sourceUrl: item.sourceUrl,
            },
            level: 'ERROR',
            message: 'public page fetch failed',
            stage: 'FETCH',
            taskId,
          });
          throw error;
        }
        fetchedCount += 1;
        const detailContentSignals = buildListPageContentSignals(
          fetchResult.bodyText,
        );
        await appendCrawlerTaskLog({
          detail: {
            bodyTextLength: fetchResult.bodyText.length,
            contentSignals: detailContentSignals,
            finalUrl: fetchResult.finalUrl,
            httpStatus: fetchResult.httpStatus,
            itemId: item.itemId,
            responseHash: fetchResult.responseHash,
            sourceUrl: item.sourceUrl,
          },
          level: fetchResult.ok ? 'INFO' : 'WARN',
          message: 'public page fetched',
          stage: 'FETCH',
          taskId,
        });
        if (!fetchResult.ok) {
          if (
            fetchResult.httpStatus === 404 ||
            fetchResult.httpStatus === 410 ||
            detailContentSignals.hasNotFoundHint
          ) {
            skippedCount += 1;
            const reason = `HTTP_${fetchResult.httpStatus}`;
            await markCrawlerTaskItemSkipped({
              itemId: item.itemId,
              parsedPayload: {
                contentIssue: detailContentSignals.hasNotFoundHint
                  ? 'NOT_FOUND'
                  : reason,
                finalUrl: fetchResult.finalUrl,
                responseHash: fetchResult.responseHash,
                signals: detailContentSignals,
              },
              reason,
              taskId,
            });
            await appendCrawlerTaskLog({
              detail: {
                contentIssue: detailContentSignals.hasNotFoundHint
                  ? 'NOT_FOUND'
                  : reason,
                finalUrl: fetchResult.finalUrl,
                httpStatus: fetchResult.httpStatus,
                itemId: item.itemId,
                sourceUrl: item.sourceUrl,
              },
              level: 'WARN',
              message: 'public page not found skipped',
              stage: 'POLICY_SKIP',
              taskId,
            });
            continue;
          }
          const failed = await markCrawlerTaskItemFailed({
            httpStatus: fetchResult.httpStatus,
            itemId: item.itemId,
            maxRetryCount: options.maxRetryCount,
            message: `HTTP_${fetchResult.httpStatus}`,
            retryDelayMinutes: options.retryDelayMinutes,
            taskId,
          });
          await appendCrawlerTaskLog({
            detail: {
              finalStatus: failed.finalStatus,
              itemId: item.itemId,
              retryCount: failed.retryCount,
              sourceUrl: item.sourceUrl,
            },
            level: 'WARN',
            message: 'public page fetch failed',
            stage: 'ITEM_FAIL',
            taskId,
          });
          continue;
        }

        const effectiveSourceUrl = fetchResult.finalUrl || item.sourceUrl;
        const finalPolicyFailureReason =
          effectiveSourceUrl === item.sourceUrl
            ? null
            : buildUrlPolicyFailureReason(effectiveSourceUrl, source);
        if (finalPolicyFailureReason) {
          skippedCount += 1;
          const reason = `FINAL_${finalPolicyFailureReason}`.slice(0, 255);
          await markCrawlerTaskItemSkipped({
            itemId: item.itemId,
            parsedPayload: {
              finalUrl: effectiveSourceUrl,
              sourceUrl: item.sourceUrl,
            },
            reason,
            taskId,
          });
          await appendCrawlerTaskLog({
            detail: {
              finalUrl: effectiveSourceUrl,
              itemId: item.itemId,
              reason,
              sourceUrl: item.sourceUrl,
            },
            level: 'WARN',
            message: 'public page final URL skipped by allowlist',
            stage: 'POLICY_SKIP',
            taskId,
          });
          continue;
        }

        const detailContentIssue = resolveDetailPageContentIssue({
          bodyText: fetchResult.bodyText,
          signals: detailContentSignals,
        });
        if (detailContentIssue) {
          if (detailContentIssue.action === 'RETRY') {
            const failed = await markCrawlerTaskItemFailed({
              httpStatus: fetchResult.httpStatus,
              itemId: item.itemId,
              maxRetryCount: options.maxRetryCount,
              message: detailContentIssue.code,
              retryDelayMinutes: options.retryDelayMinutes,
              taskId,
            });
            await appendCrawlerTaskLog({
              detail: {
                contentIssue: detailContentIssue.code,
                finalStatus: failed.finalStatus,
                finalUrl: effectiveSourceUrl,
                itemId: item.itemId,
                retryCount: failed.retryCount,
                signals: detailContentSignals,
                sourceUrl: item.sourceUrl,
              },
              level: 'WARN',
              message: 'public detail page blocked or requires retry',
              stage: 'ITEM_FAIL',
              taskId,
            });
          } else {
            skippedCount += 1;
            await markCrawlerTaskItemSkipped({
              itemId: item.itemId,
              parsedPayload: {
                contentIssue: detailContentIssue.code,
                finalUrl: effectiveSourceUrl,
                responseHash: fetchResult.responseHash,
                signals: detailContentSignals,
              },
              reason: detailContentIssue.code,
              taskId,
            });
            await appendCrawlerTaskLog({
              detail: {
                contentIssue: detailContentIssue.code,
                finalUrl: effectiveSourceUrl,
                itemId: item.itemId,
                responseHash: fetchResult.responseHash,
                signals: detailContentSignals,
                sourceUrl: item.sourceUrl,
              },
              level: 'WARN',
              message: 'public detail page skipped by content diagnostics',
              stage: 'POLICY_SKIP',
              taskId,
            });
          }
          continue;
        }

        let parseMeta: null | SyntheticOpportunityParseMeta = null;
        let row: null | PublicOpportunityRow = null;
        let opportunityUpsert: Awaited<
          ReturnType<typeof upsertCrawlerPublicOpportunity>
        > | null = null;
        const crawledAt = new Date();
        const adapterExtracted = extractAdapterParsedPublicOpportunity({
          adapter,
          bodyHtml: fetchResult.bodyHtml,
          crawledAt,
          sourceUrl: effectiveSourceUrl,
        });

        if (adapterExtracted) {
          parseMeta = buildParseMetaFromParsedOpportunity(adapterExtracted);
          const scopeSkipReason = buildDemandCrawlerScopeSkipReason({
            bodyText: fetchResult.bodyText,
            freshnessDays: options.freshnessDays,
            opportunityType: adapterExtracted.opportunityType,
            parseMeta,
            publishedAt: adapterExtracted.publishedAt,
            row: {
              areaText: adapterExtracted.areaText,
              city: adapterExtracted.city,
              contactName: adapterExtracted.contactName,
              description: adapterExtracted.description,
              detailJson: adapterExtracted.detailJson,
              district: adapterExtracted.district,
              industryText: adapterExtracted.industryText,
              opportunityId: 0,
              opportunityType: adapterExtracted.opportunityType,
              phoneNumber: adapterExtracted.phoneNumber,
              priceText: adapterExtracted.priceText,
              publishedAt: adapterExtracted.publishedAt,
              sourceSite: adapterExtracted.sourceSite,
              sourceTable: 'public_platform_adapter',
              sourceUrl: adapterExtracted.sourceUrl || effectiveSourceUrl,
              title: adapterExtracted.title,
            },
            sourceUrl: adapterExtracted.sourceUrl || effectiveSourceUrl,
          });
          if (scopeSkipReason) {
            skippedCount += 1;
            await skipCrawlerTaskItemByDemandScope({
              finalUrl: effectiveSourceUrl,
              freshnessDays: options.freshnessDays,
              item,
              parseMeta,
              reason: scopeSkipReason,
              responseHash: fetchResult.responseHash,
              taskId,
            });
            continue;
          }
          opportunityUpsert = await upsertCrawlerPublicOpportunity(
            buildPublicOpportunityInputFromAdapterExtract({
              opportunity: adapterExtracted,
              responseHash: fetchResult.responseHash,
              sourceCode: adapter.sourceCode,
              sourceName: source.sourceName,
              sourceUrl: effectiveSourceUrl,
            }),
          );
          row =
            (opportunityUpsert.opportunity as null | PublicOpportunityRow) ||
            null;
        } else {
          const syntheticBuild =
            buildSyntheticPublicOpportunityRowFromFetchedPage({
              bodyHtml: fetchResult.bodyHtml,
              bodyText: fetchResult.bodyText,
              opportunityType,
              sourceCode: source.sourceCode,
              sourceName: source.sourceName,
              sourceSite: adapter.sourceSite || source.sourceName,
              sourceUrl: effectiveSourceUrl,
              crawledAt,
            });
          parseMeta = syntheticBuild?.parseMeta || null;
          row = item.sourceRefId
            ? await getPublicOpportunityRowById(item.sourceRefId)
            : syntheticBuild?.row;
          if (row && parseMeta) {
            const fallbackResult = applyPlatformParseFallbacks({
              parseMeta,
              row,
              sourceCode: source.sourceCode,
              sourceUrl: effectiveSourceUrl,
            });
            parseMeta = fallbackResult.parseMeta;
            row = fallbackResult.row;
          }
          if (!row) {
            skippedCount += 1;
            const reason = detailContentSignals.hasDetailHint
              ? 'SOURCE_ROW_NOT_FOUND'
              : 'NO_DETAIL_SIGNAL';
            await markCrawlerTaskItemSkipped({
              itemId: item.itemId,
              parsedPayload: {
                finalUrl: effectiveSourceUrl,
                responseHash: fetchResult.responseHash,
                signals: detailContentSignals,
              },
              reason,
              taskId,
            });
            continue;
          }

          const rowOpportunityType =
            row.opportunityType === 'SUPPLY' ? 'SUPPLY' : 'DEMAND';
          const preparedRow = {
            ...row,
            description: row.description || fetchResult.bodyText,
            opportunityType: rowOpportunityType,
            publishedAt: row.publishedAt || parseMeta?.publishedAt || null,
            sourceSite:
              adapter.sourceSite || row.sourceSite || source.sourceName,
            sourceUrl: row.sourceUrl || effectiveSourceUrl,
          };
          const scopeSkipReason = buildDemandCrawlerScopeSkipReason({
            bodyText: fetchResult.bodyText,
            freshnessDays: options.freshnessDays,
            opportunityType: rowOpportunityType,
            parseMeta,
            publishedAt: preparedRow.publishedAt,
            row: preparedRow,
            sourceUrl: effectiveSourceUrl,
          });
          if (scopeSkipReason) {
            skippedCount += 1;
            await skipCrawlerTaskItemByDemandScope({
              finalUrl: effectiveSourceUrl,
              freshnessDays: options.freshnessDays,
              item,
              parseMeta,
              reason: scopeSkipReason,
              responseHash: fetchResult.responseHash,
              taskId,
            });
            continue;
          }
          opportunityUpsert = await upsertFetchedPublicOpportunity({
            parseMeta,
            responseHash: fetchResult.responseHash,
            row: preparedRow,
            sourceCode: source.sourceCode,
            sourceName: source.sourceName,
            sourceUrl: effectiveSourceUrl,
          });
          row =
            (opportunityUpsert?.opportunity as null | PublicOpportunityRow) ||
            row;
        }

        if (!row) {
          skippedCount += 1;
          const reason = detailContentSignals.hasDetailHint
            ? 'SOURCE_ROW_NOT_FOUND'
            : 'NO_DETAIL_SIGNAL';
          await markCrawlerTaskItemSkipped({
            itemId: item.itemId,
            parsedPayload: {
              finalUrl: effectiveSourceUrl,
              responseHash: fetchResult.responseHash,
              signals: detailContentSignals,
            },
            reason,
            taskId,
          });
          continue;
        }

        const opportunityId =
          Number(opportunityUpsert?.opportunity?.opportunityId || 0) ||
          row.opportunityId ||
          null;
        const qualityResult = opportunityUpsert?.qualityResult || null;

        if (opportunityUpsert && !isEffectiveCrawlerUpsert(opportunityUpsert)) {
          skippedCount += 1;
          if (opportunityUpsert.created) {
            createdLeadCount += 1;
          } else {
            updatedLeadCount += 1;
          }
          await markCrawlerTaskItemSuccess({
            httpStatus: fetchResult.httpStatus,
            itemId: item.itemId,
            parsedPayload: {
              effective: false,
              opportunityCreated: Boolean(opportunityUpsert.created),
              opportunityId,
              opportunityStatus:
                opportunityUpsert.opportunity?.opportunityStatus || null,
              parseMeta,
              qualityResult,
              responseHash: fetchResult.responseHash,
            },
            publishedAt: parseMeta?.publishedAt || row.publishedAt || null,
            responseText: fetchResult.bodyText,
            taskId,
          });
          await appendCrawlerTaskLog({
            detail: {
              itemId: item.itemId,
              opportunityCreated: Boolean(opportunityUpsert.created),
              opportunityId,
              opportunityStatus:
                opportunityUpsert.opportunity?.opportunityStatus || null,
              parseMeta,
              qualityResult,
              sourceUrl: item.sourceUrl,
            },
            level: 'WARN',
            message:
              'public opportunity upserted without EFFECTIVE quality status',
            stage: 'POLICY_SKIP',
            taskId,
          });
          continue;
        }

        if (row.opportunityType === 'SUPPLY') {
          if (!opportunityUpsert) {
            skippedCount += 1;
            await markCrawlerTaskItemSkipped({
              itemId: item.itemId,
              reason: 'PUBLIC_OPPORTUNITY_NOT_SYNCED',
              taskId,
            });
            continue;
          }
          if (opportunityUpsert.created) {
            createdLeadCount += 1;
          } else {
            updatedLeadCount += 1;
          }
          await markCrawlerTaskItemSuccess({
            httpStatus: fetchResult.httpStatus,
            itemId: item.itemId,
            parsedPayload: {
              opportunityCreated: Boolean(opportunityUpsert.created),
              opportunityId,
              parseMeta,
              qualityResult,
              responseHash: fetchResult.responseHash,
            },
            publishedAt: parseMeta?.publishedAt || row.publishedAt || null,
            responseText: fetchResult.bodyText,
            taskId,
          });
          await appendCrawlerTaskLog({
            detail: {
              itemId: item.itemId,
              opportunityCreated: Boolean(opportunityUpsert.created),
              opportunityId,
              parseMeta,
              qualityResult,
              sourceUrl: item.sourceUrl,
            },
            level: 'INFO',
            message:
              'public factory listing URL item upserted to public opportunity',
            stage: 'ITEM_SUCCESS',
            taskId,
          });
          continue;
        }

        const buildResult = buildExternalLeadInputFromPublicOpportunityRow(
          {
            ...row,
            opportunityId: opportunityId || row.opportunityId,
          },
          {
            crawledAt: new Date().toISOString(),
            rawEvidenceSuffix: fetchResult.bodyText,
            sourceName: row.sourceSite || source.sourceName,
            sourceType: 'PUBLIC_OPPORTUNITY',
          },
        );
        if (buildResult.skipReason) {
          if (opportunityUpsert?.created) {
            createdLeadCount += 1;
          } else if (opportunityUpsert) {
            updatedLeadCount += 1;
          }
          if (opportunityUpsert) {
            await markCrawlerTaskItemSuccess({
              httpStatus: fetchResult.httpStatus,
              itemId: item.itemId,
              parsedPayload: {
                leadConverted: false,
                leadSkipReason: buildResult.skipReason,
                opportunityCreated: Boolean(opportunityUpsert.created),
                opportunityId,
                parseMeta,
                qualityResult,
                responseHash: fetchResult.responseHash,
              },
              publishedAt: parseMeta?.publishedAt || row.publishedAt || null,
              responseText: fetchResult.bodyText,
              taskId,
            });
          } else {
            skippedCount += 1;
            await markCrawlerTaskItemSkipped({
              itemId: item.itemId,
              reason: buildResult.skipReason,
              taskId,
            });
          }
          await appendCrawlerTaskLog({
            detail: {
              leadConverted: false,
              itemId: item.itemId,
              opportunityCreated: Boolean(opportunityUpsert?.created),
              opportunityId,
              parseMeta,
              qualityResult,
              reason: buildResult.skipReason,
              sourceUrl: item.sourceUrl,
            },
            level: 'WARN',
            message: 'public opportunity synced but skipped by lead policy',
            stage: 'POLICY_SKIP',
            taskId,
          });
          continue;
        }

        const upsertResult = await upsertExternalLeadFromCrawler(
          buildResult.input,
        );
        if (upsertResult.created) {
          createdLeadCount += 1;
        } else {
          updatedLeadCount += 1;
        }
        await markCrawlerTaskItemSuccess({
          httpStatus: fetchResult.httpStatus,
          itemId: item.itemId,
          parsedPayload: {
            evidenceIds: upsertResult.evidenceIds,
            leadId: upsertResult.leadId,
            matchedKeywords: buildResult.matchedKeywords,
            opportunityCreated: Boolean(opportunityUpsert?.created),
            opportunityId,
            parseMeta,
            qualityResult,
            responseHash: fetchResult.responseHash,
          },
          publishedAt: parseMeta?.publishedAt || row.publishedAt || null,
          responseText: fetchResult.bodyText,
          taskId,
        });
        await appendCrawlerTaskLog({
          detail: {
            evidenceCreatedCount: upsertResult.evidenceCreatedCount,
            evidenceUpdatedCount: upsertResult.evidenceUpdatedCount,
            itemId: item.itemId,
            leadId: upsertResult.leadId,
            parseMeta,
            qualityResult,
            sourceUrl: item.sourceUrl,
          },
          level: 'INFO',
          message: 'public opportunity URL item converted to external lead',
          stage: 'ITEM_SUCCESS',
          taskId,
        });
      } catch (error) {
        if (error instanceof PublicOpportunityQualitySkipError) {
          skippedCount += 1;
          await markCrawlerTaskItemSkipped({
            itemId: item.itemId,
            parsedPayload: {
              qualityResult: error.qualityResult,
              sourceUrl: item.sourceUrl,
            },
            reason: buildQualitySkipReason(error),
            taskId,
          });
          await appendCrawlerTaskLog({
            detail: {
              itemId: item.itemId,
              qualityResult: error.qualityResult,
              sourceUrl: item.sourceUrl,
            },
            level: 'WARN',
            message: 'public opportunity skipped by quality policy',
            stage: 'POLICY_SKIP',
            taskId,
          });
          continue;
        }

        const message = error instanceof Error ? error.message : String(error);
        const failed = await markCrawlerTaskItemFailed({
          itemId: item.itemId,
          maxRetryCount: options.maxRetryCount,
          message,
          retryDelayMinutes: options.retryDelayMinutes,
          taskId,
        });
        await appendCrawlerTaskLog({
          detail: {
            ...buildFetchErrorDetail(error),
            finalStatus: failed.finalStatus,
            itemId: item.itemId,
            retryCount: failed.retryCount,
            sourceUrl: item.sourceUrl,
          },
          level: 'ERROR',
          message,
          stage: 'ITEM_FAIL',
          taskId,
        });
      }
    }

    const finishOutcome = resolvePublicOpportunityTaskFinishOutcome({
      createdLeadCount,
      discoverList: options.discoverList,
      discoveryResult: listDiscoveryResult,
      fetchedCount,
      itemCount: items.length,
      skippedCount,
      updatedLeadCount,
    });
    const finishedAt = new Date();
    await markCrawlerSourceCrawled(source.sourceId);
    await updateCrawlerTaskStatus({
      crawlEndedAt: finishedAt,
      createdLeadCount,
      errorMessage: finishOutcome.errorMessage,
      fetchedCount,
      finishedAt,
      skippedCount,
      skipReason: finishOutcome.errorMessage,
      status: taskBudgetExceeded ? 'SUCCESS' : finishOutcome.status,
      taskId,
      updatedLeadCount,
    });
    await appendCrawlerTaskLog({
      detail: {
        contentIssueSamples: listDiscoveryResult.contentIssueSamples,
        createdLeadCount,
        discoveredCount: listDiscoveryResult.discoveredDetailCount,
        discoveryResult: listDiscoveryResult,
        errorMessage: finishOutcome.errorMessage,
        taskBudgetExceeded,
        fetchedCount,
        httpStatus: listDiscoveryResult.nonOkSamples[0]?.httpStatus || null,
        listFinalUrl:
          listDiscoveryResult.contentIssueSamples[0]?.finalUrl ||
          listDiscoveryResult.nonOkSamples[0]?.finalUrl ||
          null,
        seedCreatedCount: listDiscoveryResult.seedCreatedCount,
        seedUpdatedCount: listDiscoveryResult.seedUpdatedCount,
        skippedCount,
        status: taskBudgetExceeded ? 'SUCCESS' : finishOutcome.status,
        updatedLeadCount,
      },
      level:
        finishOutcome.status === 'SUCCESS' || taskBudgetExceeded
          ? 'INFO'
          : 'ERROR',
      message:
        finishOutcome.status === 'SUCCESS' || taskBudgetExceeded
          ? 'public opportunity URL crawler task finished'
          : 'public opportunity URL crawler task finished with list discovery failure',
      stage: 'FINISH',
      taskId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finishedAt = new Date();
    await updateCrawlerTaskStatus({
      crawlEndedAt: finishedAt,
      createdLeadCount,
      errorMessage: message,
      fetchedCount,
      finishedAt,
      skippedCount,
      skipReason: message,
      status: 'FAILED',
      taskId,
      updatedLeadCount,
    });
    await appendCrawlerTaskLog({
      detail: { errorMessage: message },
      level: 'ERROR',
      message: 'public opportunity URL crawler task failed',
      stage: 'FINISH',
      taskId,
    });
  }

  const task = await getCrawlerTaskDetail(taskId);
  if (!task) {
    throw new Error('crawler task not found after public opportunity run');
  }
  return task;
}

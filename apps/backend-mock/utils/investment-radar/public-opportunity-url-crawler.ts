import type { ParsedPublicOpportunity } from './crawler-adapters/types';
import type {
  CrawlerTask,
  PublicOpportunityCrawlerRunOptions,
} from './crawler-types';
import type { PublicOpportunityRow } from './public-opportunity-lead-rebuilder';
import type { PublicOpportunityCrawlerInput } from './public-opportunity-repository';

import { createHash } from 'node:crypto';

import { prismaClient } from '~/utils/db';

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
} from './crawler-types';
import { upsertExternalLeadFromCrawler } from './external-lead-repository';
import { getPublicCrawlerAdapter } from './public-crawler-adapters';
import { buildExternalLeadInputFromPublicOpportunityRow } from './public-opportunity-lead-rebuilder';
import {
  PublicOpportunityQualitySkipError,
  upsertCrawlerPublicOpportunity,
} from './public-opportunity-repository';

const DEFAULT_BATCH_SIZE = 80;
const DEFAULT_FRESHNESS_DAYS = 365;
const MAX_BATCH_SIZE = 500;
const DEFAULT_MAX_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MINUTES = 30;
const DEFAULT_STALE_RUNNING_MINUTES = 15;
const FETCH_TIMEOUT_MS = 10_000;
const RESPONSE_TEXT_TIMEOUT_MS = 10_000;
const SHENZHEN_CITY_NAME = '\u6DF1\u5733';

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
  };
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

function resolveRateLimitDelayMs(rateLimitPerMinute: number) {
  const normalized = Math.max(1, Math.floor(Number(rateLimitPerMinute) || 1));
  return Math.ceil((60 * 1000) / normalized);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function queryFreshDemandRows(freshnessDays: number) {
  return prismaClient.$queryRawUnsafe<PublicOpportunityRow[]>(
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
        AND published_at IS NOT NULL
        AND published_at >= DATE_SUB(NOW(3), INTERVAL ? DAY)
      ORDER BY published_at DESC, opportunity_id DESC
    `,
    freshnessDays,
  );
}

async function queryFreshRowsByType(params: {
  freshnessDays: number;
  opportunityType: 'DEMAND' | 'SUPPLY';
  sourceSite: string;
}) {
  return prismaClient.$queryRawUnsafe<PublicOpportunityRow[]>(
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
        AND published_at IS NOT NULL
        AND published_at >= DATE_SUB(NOW(3), INTERVAL ? DAY)
      ORDER BY published_at DESC, opportunity_id DESC
    `,
    params.opportunityType,
    params.sourceSite,
    params.freshnessDays,
  );
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
  return rows[0] || null;
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

function decodeBasicHtmlEntities(value: string) {
  return value
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
    url.search = '';
    return url.toString();
  } catch {
    return null;
  }
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
  const date = new Date(
    `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(
      2,
      '0',
    )}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}+08:00`,
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
  return discovered;
}

async function fetchPublicPage(sourceUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'vben-investment-radar-crawler/0.1',
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

function getShanghaiDateParts(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear(),
  };
}

function buildRelativeDayIso(dayOffset: number, timeText?: null | string) {
  const base = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
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

function extractStrictRelativePublishedAt(value: string) {
  if (/\u521A\u521A|\u521A\u53D1\u5E03/.test(value)) {
    return new Date().toISOString();
  }
  const minuteAgo = /(\d{1,4})\s*\u5206\u949F\u524D/.exec(value);
  if (minuteAgo?.[1]) {
    return new Date(
      Date.now() - Number(minuteAgo[1]) * 60 * 1000,
    ).toISOString();
  }
  const hourAgo = /(\d{1,4})\s*\u5C0F\u65F6\u524D/.exec(value);
  if (hourAgo?.[1]) {
    return new Date(
      Date.now() - Number(hourAgo[1]) * 60 * 60 * 1000,
    ).toISOString();
  }
  const dayAgo = /(\d{1,4})\s*\u5929\u524D/.exec(value);
  if (dayAgo?.[1]) {
    return new Date(
      Date.now() - Number(dayAgo[1]) * 24 * 60 * 60 * 1000,
    ).toISOString();
  }
  const today = /\u4ECA\u5929\s*(\d{1,2}:\d{1,2}(?::\d{1,2})?)?/.exec(value);
  if (today?.[0]) {
    return buildRelativeDayIso(0, today[1]);
  }
  const yesterday = /\u6628\u5929\s*(\d{1,2}:\d{1,2}(?::\d{1,2})?)?/.exec(
    value,
  );
  if (yesterday?.[0]) {
    return buildRelativeDayIso(1, yesterday[1]);
  }
  const beforeYesterday = /\u524D\u5929\s*(\d{1,2}:\d{1,2}(?::\d{1,2})?)?/.exec(
    value,
  );
  if (beforeYesterday?.[0]) {
    return buildRelativeDayIso(2, beforeYesterday[1]);
  }
  return null;
}

function extractStrictPublishedAtFromText(text: string) {
  const value = extractFirstMatch(text, [
    /(?:\u66F4\u65B0\u65F6\u95F4|\u66F4\u65B0\u65E5\u671F|\u53D1\u5E03\u65F6\u95F4|\u53D1\u5E03\u65E5\u671F|\u53D1\u5E03\u4E8E)[\uFF1A:\s]*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:[T\s]\d{1,2}:\d{1,2}(?::\d{1,2})?)?)/,
    /(?:\u66F4\u65B0\u65F6\u95F4|\u66F4\u65B0\u65E5\u671F|\u53D1\u5E03\u65F6\u95F4|\u53D1\u5E03\u65E5\u671F|\u53D1\u5E03\u4E8E)[\uFF1A:\s]*(\u521A\u521A|\u521A\u53D1\u5E03|\d{1,4}\s*\u5206\u949F\u524D|\d{1,4}\s*\u5C0F\u65F6\u524D|\d{1,4}\s*\u5929\u524D|\u4ECA\u5929\s*\d{0,2}:?\d{0,2}:?\d{0,2}|\u6628\u5929\s*\d{0,2}:?\d{0,2}:?\d{0,2}|\u524D\u5929\s*\d{0,2}:?\d{0,2}:?\d{0,2})/,
  ]);
  if (!value) {
    return null;
  }
  return (
    normalizePublishedAtText(value) || extractStrictRelativePublishedAt(value)
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
  opportunityType?: 'DEMAND' | 'SUPPLY';
  sourceName: string;
  sourceSite?: string;
  sourceUrl: string;
}): { parseMeta: SyntheticOpportunityParseMeta; row: PublicOpportunityRow } {
  const bodyHtml = params.bodyHtml || '';
  const decodedBodyText = decodeUnicodeEscapes(params.bodyText);
  const decodedBodyHtml = decodeUnicodeEscapes(bodyHtml);
  const title = extractPageTitle(decodedBodyHtml, decodedBodyText);
  const companyName = extractCompanyNameFromText(decodedBodyText);
  const publishedAt = extractStrictPublishedAtFromText(decodedBodyText);
  const region = extractStrictRegionFromText(decodedBodyText);
  const areaText = extractStrictAreaTextFromText(decodedBodyText);
  const contactName = extractContactNameFromText(decodedBodyText);
  const phoneNumber = extractStrictPhoneNumberFromText(decodedBodyText);
  const priceText = extractPriceTextFromText(decodedBodyText);
  const industryText = extractIndustryTextFromText(decodedBodyText);
  const fallbackRegion = inferRegionFromCfzsw68Url(params.sourceUrl);
  const city = region.city || fallbackRegion.city;
  const district = region.district || fallbackRegion.district;
  const opportunityType = params.opportunityType || 'DEMAND';
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
    publishedAt: useStrictParsedOnly
      ? parseMeta?.publishedAt || null
      : row.publishedAt || parseMeta?.publishedAt || null,
    score: opportunityType === 'SUPPLY' ? 70 : 75,
    sourceSite: row.sourceSite || null,
    sourceTable:
      opportunityType === 'DEMAND'
        ? 'investment_public_demand'
        : 'investment_public_opportunity',
    sourceUrl: row.sourceUrl || sourceUrl,
    tagsJson: ['crawler', opportunityType],
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

async function upsertAdapterParsedPublicOpportunity(params: {
  adapter: NonNullable<ReturnType<typeof getPublicCrawlerAdapter>>;
  bodyHtml: string;
  responseHash: string;
  sourceName: string;
  sourceUrl: string;
}) {
  if (!params.adapter.extractFromHtml) {
    return null;
  }
  const extracted = params.adapter.extractFromHtml(
    params.bodyHtml,
    params.sourceUrl,
  );
  const upsertResult = await upsertCrawlerPublicOpportunity(
    buildPublicOpportunityInputFromAdapterExtract({
      opportunity: extracted,
      responseHash: params.responseHash,
      sourceCode: params.adapter.sourceCode,
      sourceName: params.sourceName,
      sourceUrl: params.sourceUrl,
    }),
  );
  return { extracted, upsertResult };
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
      sourceCode: source.sourceCode,
    },
    sourceId: source.sourceId,
    taskType: 'PUBLIC_OPPORTUNITY_URL_BATCH',
  });
  const startedAt = new Date();
  const freshAfter = new Date(
    startedAt.getTime() - options.freshnessDays * 24 * 60 * 60 * 1000,
  );
  let createdLeadCount = 0;
  let fetchedCount = 0;
  let skippedCount = 0;
  let updatedLeadCount = 0;

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
      for (const listUrl of listUrls) {
        const listPolicyFailureReason = adapter.validateListUrl(listUrl);
        if (listPolicyFailureReason) {
          await appendCrawlerTaskLog({
            detail: { listPolicyFailureReason, listUrl },
            level: 'WARN',
            message: 'public opportunity list URL skipped by policy',
            stage: 'DISCOVER',
            taskId,
          });
          continue;
        }
        try {
          const listFetchResult = await fetchPublicPage(listUrl);
          await appendCrawlerTaskLog({
            detail: {
              httpStatus: listFetchResult.httpStatus,
              listUrl,
              responseHash: listFetchResult.responseHash,
            },
            level: listFetchResult.ok ? 'INFO' : 'WARN',
            message: 'public opportunity list page fetched',
            stage: 'DISCOVER',
            taskId,
          });
          if (listFetchResult.ok) {
            const discoveredUrls = extractPublicOpportunityDetailUrls(
              listFetchResult.bodyHtml,
              listUrl,
              source,
            );
            const discoverSeedResult = await seedCrawlerTaskItems(
              discoveredUrls.map((item) => ({
                maxRetryCount: options.maxRetryCount,
                publishedAt: item.publishedAt || null,
                sourceId: source.sourceId,
                sourceRefId: null,
                sourceRefType: `${source.sourceCode}_list_discovery`,
                sourceUrl: item.sourceUrl,
              })),
            );
            await appendCrawlerTaskLog({
              detail: {
                discoveredCount: discoveredUrls.length,
                sampleUrls: discoveredUrls.slice(0, 5),
                seedCreatedCount: discoverSeedResult.createdCount,
                seedUpdatedCount: discoverSeedResult.updatedCount,
              },
              level: 'INFO',
              message: 'public opportunity list URLs discovered and queued',
              stage: 'DISCOVER',
              taskId,
            });
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          await appendCrawlerTaskLog({
            detail: { errorMessage: message, listUrl },
            level: 'ERROR',
            message: 'public opportunity list discovery failed',
            stage: 'DISCOVER',
            taskId,
          });
        }
      }
    }

    const freshRows =
      source.sourceCode === PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE
        ? await queryFreshDemandRows(options.freshnessDays)
        : await queryFreshRowsByType({
            freshnessDays: options.freshnessDays,
            opportunityType,
            sourceSite: adapter?.sourceSite || source.sourceName,
          });
    const rejectedSeedRows = freshRows
      .map((row) => ({
        opportunityId: row.opportunityId,
        reason: row.sourceUrl
          ? buildUrlPolicyFailureReason(row.sourceUrl, source)
          : 'URL_EMPTY',
        sourceUrl: row.sourceUrl || null,
      }))
      .filter((item) => item.reason);
    const seedInputs = freshRows
      .filter(
        (row) => row.sourceUrl && isAllowedSourceUrl(row.sourceUrl, source),
      )
      .map((row) => ({
        maxRetryCount: options.maxRetryCount,
        publishedAt: row.publishedAt || null,
        sourceId: source.sourceId,
        sourceRefId: row.opportunityId,
        sourceRefType: 'investment_public_opportunity',
        sourceUrl: String(row.sourceUrl),
      }));
    const prioritySourceRefIds =
      opportunityType === 'DEMAND'
        ? (freshRows
            .map((row) => {
              const buildResult =
                buildExternalLeadInputFromPublicOpportunityRow(row);
              return buildResult.skipReason ? null : row.opportunityId;
            })
            .filter(Boolean) as number[])
        : freshRows.map((row) => row.opportunityId).filter(Boolean);
    const seedResult = await seedCrawlerTaskItems(seedInputs);
    await appendCrawlerTaskLog({
      detail: {
        freshnessDays: options.freshnessDays,
        priorityItemCount: prioritySourceRefIds.length,
        rejectedSeedCount: rejectedSeedRows.length,
        rejectedSeedSamples: rejectedSeedRows.slice(0, 5),
        seedCreatedCount: seedResult.createdCount,
        seedUpdatedCount: seedResult.updatedCount,
        sourceRowCount: freshRows.length,
      },
      level: 'INFO',
      message: 'public opportunity URL queue seeded',
      stage: 'QUEUE',
      taskId,
    });

    const items = await listRunnableCrawlerTaskItems({
      allowUnknownPublishedAt: true,
      freshAfter,
      limit: options.batchSize,
      prioritySourceRefIds,
      reprocessSuccess: options.reprocessSuccess,
      sourceId: source.sourceId,
    });
    await appendCrawlerTaskLog({
      detail: { itemCount: items.length },
      level: 'INFO',
      message: 'public opportunity URL batch claimed',
      stage: 'QUEUE',
      taskId,
    });

    const rateLimitDelayMs = resolveRateLimitDelayMs(source.rateLimitPerMinute);
    let lastFetchStartedAt = 0;
    for (const item of items) {
      const claimed = await claimCrawlerTaskItem({
        itemId: item.itemId,
        reprocessSuccess: options.reprocessSuccess,
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
          const message =
            error instanceof Error ? error.message : String(error);
          await appendCrawlerTaskLog({
            detail: {
              itemId: item.itemId,
              reason: message,
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
        await appendCrawlerTaskLog({
          detail: {
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

        let parseMeta: null | SyntheticOpportunityParseMeta = null;
        let row: null | PublicOpportunityRow = null;
        let opportunityUpsert: Awaited<
          ReturnType<typeof upsertCrawlerPublicOpportunity>
        > | null = null;
        const adapterParsed = await upsertAdapterParsedPublicOpportunity({
          adapter,
          bodyHtml: fetchResult.bodyHtml,
          responseHash: fetchResult.responseHash,
          sourceName: source.sourceName,
          sourceUrl: item.sourceUrl,
        });

        if (adapterParsed) {
          parseMeta = buildParseMetaFromParsedOpportunity(
            adapterParsed.extracted,
          );
          opportunityUpsert = adapterParsed.upsertResult;
          row =
            (opportunityUpsert.opportunity as null | PublicOpportunityRow) ||
            null;
        } else {
          const syntheticBuild =
            buildSyntheticPublicOpportunityRowFromFetchedPage({
              bodyHtml: fetchResult.bodyHtml,
              bodyText: fetchResult.bodyText,
              opportunityType,
              sourceName: source.sourceName,
              sourceSite: adapter.sourceSite || source.sourceName,
              sourceUrl: item.sourceUrl,
            });
          parseMeta = syntheticBuild?.parseMeta || null;
          row = item.sourceRefId
            ? await getPublicOpportunityRowById(item.sourceRefId)
            : syntheticBuild?.row;
          if (!row) {
            skippedCount += 1;
            await markCrawlerTaskItemSkipped({
              itemId: item.itemId,
              reason: 'SOURCE_ROW_NOT_FOUND',
              taskId,
            });
            continue;
          }

          const shouldSyncPublicOpportunity =
            opportunityType === 'SUPPLY' ||
            source.sourceCode === PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE;
          opportunityUpsert = shouldSyncPublicOpportunity
            ? await upsertFetchedPublicOpportunity({
                parseMeta,
                responseHash: fetchResult.responseHash,
                row: {
                  ...row,
                  description: row.description || fetchResult.bodyText,
                  opportunityType,
                  publishedAt:
                    row.publishedAt || parseMeta?.publishedAt || null,
                  sourceSite:
                    adapter.sourceSite || row.sourceSite || source.sourceName,
                  sourceUrl: row.sourceUrl || item.sourceUrl,
                },
                sourceUrl: item.sourceUrl,
              })
            : null;
          row =
            (opportunityUpsert?.opportunity as null | PublicOpportunityRow) ||
            row;
        }

        if (!row) {
          skippedCount += 1;
          await markCrawlerTaskItemSkipped({
            itemId: item.itemId,
            reason: 'SOURCE_ROW_NOT_FOUND',
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

        if (opportunityType === 'SUPPLY') {
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

    const finishedAt = new Date();
    await markCrawlerSourceCrawled(source.sourceId);
    await updateCrawlerTaskStatus({
      crawlEndedAt: finishedAt,
      createdLeadCount,
      fetchedCount,
      finishedAt,
      skippedCount,
      status: 'SUCCESS',
      taskId,
      updatedLeadCount,
    });
    await appendCrawlerTaskLog({
      detail: {
        createdLeadCount,
        fetchedCount,
        skippedCount,
        updatedLeadCount,
      },
      level: 'INFO',
      message: 'public opportunity URL crawler task finished',
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

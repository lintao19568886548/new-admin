import type {
  CrawlerTask,
  PublicOpportunityCrawlerRunOptions,
} from './crawler-types';
import type { PublicOpportunityRow } from './public-opportunity-lead-rebuilder';

import { createHash } from 'node:crypto';

import { prismaClient } from '~/utils/db';

import {
  checkCrawlerIntervalPolicy,
  checkCrawlerSourcePolicy,
  PUBLIC_FACTORY_CFZSW68_ALLOWED_HOST,
  PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS,
  PUBLIC_OPPORTUNITY_99CFW_ALLOWED_HOST,
  PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS,
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
import { upsertCrawlerPublicOpportunity } from './public-opportunity-repository';

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_FRESHNESS_DAYS = 180;
const DEFAULT_MAX_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MINUTES = 30;
const DEFAULT_STALE_RUNNING_MINUTES = 15;
const FETCH_TIMEOUT_MS = 10_000;
const RESPONSE_TEXT_TIMEOUT_MS = 10_000;
const SHENZHEN_CITY_NAME = '\u6DF1\u5733';

interface DiscoveredPublicUrl {
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
  title?: null | string;
}

interface OpportunityUpsertPayload {
  parseMeta?: null | SyntheticOpportunityParseMeta;
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
    batchSize: clampInt(options.batchSize, DEFAULT_BATCH_SIZE, 1, 20),
    discoverList: options.discoverList !== false,
    freshnessDays: clampInt(
      options.freshnessDays,
      DEFAULT_FRESHNESS_DAYS,
      1,
      DEFAULT_FRESHNESS_DAYS,
    ),
    maxRetryCount: clampInt(
      options.maxRetryCount,
      DEFAULT_MAX_RETRY_COUNT,
      1,
      10,
    ),
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

function resolveOpportunityTypeBySourceCode(sourceCode: string) {
  return sourceCode === PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE
    ? 'SUPPLY'
    : 'DEMAND';
}

async function queryFreshDemandRows(freshnessDays: number) {
  return prismaClient.$queryRawUnsafe<PublicOpportunityRow[]>(
    `
      SELECT
        opportunity_id AS opportunityId,
        opportunity_type AS opportunityType,
        source_site AS sourceSite,
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
    const url = new URL(decodeBasicHtmlEntities(href).trim(), baseUrl);
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch {
    return null;
  }
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
  const anchorPattern =
    /<a(?:\s[^>]*)?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const sourceUrl = normalizeDiscoveredUrl(match[1] || '', listUrl);
    if (!sourceUrl || seen.has(sourceUrl)) {
      continue;
    }
    if (buildUrlPolicyFailureReason(sourceUrl, source)) {
      continue;
    }
    seen.add(sourceUrl);
    discovered.push({
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
      redirect: 'manual',
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
  const title = extractFirstMatch(html, [
    /<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/i,
    /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i,
  ]);
  const normalizedTitle = title
    ? stripHtml(title)
        .replace(/[-_丨|].*99cfw.*$/i, '')
        .trim()
    : '';
  return normalizedTitle || bodyText.split(/\s+/).slice(0, 18).join(' ');
}

function extractPublishedAtFromText(text: string) {
  const value = extractFirstMatch(text, [
    /(?:发布时间|发布日期|更新时间|发布于|时间)[：:\s]*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2})/,
    /(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2})/,
  ]);
  if (!value) {
    return null;
  }
  const normalized = value
    .replace('年', '-')
    .replace('月', '-')
    .replace('日', '')
    .replaceAll('/', '-')
    .replaceAll('.', '-');
  const date = new Date(`${normalized}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractAreaTextFromText(text: string) {
  return extractFirstMatch(text, [
    /(?:面积|需求面积|厂房面积)[：:\s]*([0-9.,，]+\s*(?:㎡|平方米|平米|m2))/i,
    /([0-9.,，]+\s*(?:㎡|平方米|平米|m2))/i,
  ]);
}

function extractPriceTextFromText(text: string) {
  return extractFirstMatch(text, [
    /(?:租金|价格|单价)[：:\s]*([0-9.,]+\s*(?:元|块|RMB)?\s*\/?\s*(?:㎡|平米|平方|m2)?\s*\/?\s*(?:月|天)?)/i,
    /([0-9.,]+\s*(?:元|块)\s*\/?\s*(?:㎡|平米|平方|m2)?\s*\/?\s*(?:月|天)?)/i,
  ]);
}

function extractContactNameFromText(text: string) {
  return extractFirstMatch(text, [
    /(?:联系人|联系 人|联 系 人)[：:\s]*([\u4E00-\u9FA5a-z]{2,12})/i,
  ]);
}

function extractPhoneNumberFromText(text: string) {
  return extractFirstMatch(text, [
    /(?:电话|联系电话|手机)[：:\s]*(1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})/,
    /(1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})/,
  ]);
}

function extractRegionFromText(text: string) {
  const city = extractFirstMatch(text, [
    /(?:城市|所在地|地区|区域)[：:\s]*([\u4E00-\u9FA5]{2,20}[市州盟])/,
    /([\u4E00-\u9FA5]{2,20}市)/,
  ]);
  const district = extractFirstMatch(text, [
    /(?:区县|所在区|区域)[：:\s]*([\u4E00-\u9FA5]{2,20}[区县镇])/,
    /([\u4E00-\u9FA5]{2,20}[区县镇])/,
  ]);
  return { city, district };
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
  const publishedAt = extractPublishedAtFromText(decodedBodyText);
  const region = extractRegionFromText(decodedBodyText);
  const areaText = extractAreaTextFromText(decodedBodyText);
  const contactName = extractContactNameFromText(decodedBodyText);
  const phoneNumber = extractPhoneNumberFromText(decodedBodyText);
  const priceText = extractPriceTextFromText(decodedBodyText);
  const industryText = extractIndustryTextFromText(decodedBodyText);
  const fallbackRegion = inferRegionFromCfzsw68Url(params.sourceUrl);
  const opportunityType = params.opportunityType || 'DEMAND';
  const parseMeta = {
    areaText,
    city: region.city || fallbackRegion.city,
    companyName,
    contactName,
    district: region.district || fallbackRegion.district,
    industryText,
    phoneNumber,
    priceText,
    publishedAt,
    title,
  };
  return {
    parseMeta,
    row: {
      areaText,
      city: region.city || fallbackRegion.city,
      contactName,
      description: decodedBodyText,
      detailJson: {
        companyName,
        crawledFrom: 'public_opportunity_url_crawler',
        sourceUrl: params.sourceUrl,
      },
      district: region.district || fallbackRegion.district,
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
  return upsertCrawlerPublicOpportunity({
    areaText: row.areaText || null,
    city: row.city || parseMeta?.city || null,
    contactName: row.contactName || parseMeta?.contactName || null,
    description: row.description || null,
    detailJson: {
      ...(row.detailJson &&
      typeof row.detailJson === 'object' &&
      !Array.isArray(row.detailJson)
        ? row.detailJson
        : {}),
      parseMeta: parseMeta || null,
      sourceOpportunityId: row.opportunityId || null,
    },
    district: row.district || parseMeta?.district || null,
    industryText: row.industryText || parseMeta?.industryText || null,
    opportunityType,
    phoneNumber: row.phoneNumber || parseMeta?.phoneNumber || null,
    priceText: row.priceText || parseMeta?.priceText || null,
    publishedAt: row.publishedAt || parseMeta?.publishedAt || null,
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
  const opportunityType = resolveOpportunityTypeBySourceCode(source.sourceCode);
  const precheckAt = new Date();
  const sourcePolicy = checkCrawlerSourcePolicy(source);
  if (!sourcePolicy.allowed) {
    throw new CrawlerTaskValidationError(
      sourcePolicy.reason || 'SOURCE_POLICY_REJECTED',
    );
  }
  const intervalPolicy = checkCrawlerIntervalPolicy(source, precheckAt);
  if (!intervalPolicy.allowed) {
    throw new CrawlerTaskValidationError(
      intervalPolicy.reason || 'CRAWL_INTERVAL_NOT_REACHED',
    );
  }

  const taskId = await createCrawlerTask({
    requestConfig: {
      batchSize: options.batchSize,
      freshnessDays: options.freshnessDays,
      maxRetryCount: options.maxRetryCount,
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
        allowedPathsJson: source.allowedPathsJson,
        fixedAllowedHost:
          source.sourceCode === PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE
            ? PUBLIC_FACTORY_CFZSW68_ALLOWED_HOST
            : PUBLIC_OPPORTUNITY_99CFW_ALLOWED_HOST,
        fixedAllowedPaths:
          source.sourceCode === PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE
            ? PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS
            : PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS,
        blockedPathsJson: source.blockedPathsJson,
        robotsUrl: source.robotsUrl,
      },
      level: 'INFO',
      message: 'local robots/path strategy validated; no robots.txt fetched',
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
      if (adapter) {
        const listUrl = adapter.buildListUrl();
        const listPolicyFailureReason = adapter.validateListUrl(listUrl);
        if (listPolicyFailureReason) {
          await appendCrawlerTaskLog({
            detail: { listPolicyFailureReason, listUrl },
            level: 'WARN',
            message: 'public opportunity list URL skipped by policy',
            stage: 'DISCOVER',
            taskId,
          });
        } else {
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
                  publishedAt: null,
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
      } else {
        await appendCrawlerTaskLog({
          detail: { sourceCode: source.sourceCode },
          level: 'WARN',
          message: 'public crawler adapter not found for list discovery',
          stage: 'DISCOVER',
          taskId,
        });
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

        const syntheticBuild = item.sourceRefId
          ? null
          : buildSyntheticPublicOpportunityRowFromFetchedPage({
              bodyHtml: fetchResult.bodyHtml,
              bodyText: fetchResult.bodyText,
              opportunityType,
              sourceName: source.sourceName,
              sourceSite: adapter?.sourceSite || source.sourceName,
              sourceUrl: item.sourceUrl,
            });
        const parseMeta = syntheticBuild?.parseMeta || null;
        const row = item.sourceRefId
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
        const opportunityUpsert = shouldSyncPublicOpportunity
          ? await upsertFetchedPublicOpportunity({
              parseMeta,
              row: {
                ...row,
                description: row.description || fetchResult.bodyText,
                opportunityType,
                sourceSite:
                  adapter?.sourceSite || row.sourceSite || source.sourceName,
                sourceUrl: row.sourceUrl || item.sourceUrl,
              },
              sourceUrl: item.sourceUrl,
            })
          : null;
        const opportunityId =
          Number(opportunityUpsert?.opportunity?.opportunityId || 0) ||
          row.opportunityId ||
          null;

        if (opportunityType === 'SUPPLY') {
          if (opportunityUpsert?.created) {
            createdLeadCount += 1;
          } else {
            updatedLeadCount += 1;
          }
          await markCrawlerTaskItemSuccess({
            httpStatus: fetchResult.httpStatus,
            itemId: item.itemId,
            parsedPayload: {
              opportunityCreated: Boolean(opportunityUpsert?.created),
              opportunityId,
              parseMeta,
              responseHash: fetchResult.responseHash,
            },
            responseText: fetchResult.bodyText,
            taskId,
          });
          await appendCrawlerTaskLog({
            detail: {
              itemId: item.itemId,
              opportunityCreated: Boolean(opportunityUpsert?.created),
              opportunityId,
              parseMeta,
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
            sourceUrl: item.sourceUrl,
          },
          level: 'INFO',
          message: 'public opportunity URL item converted to external lead',
          stage: 'ITEM_SUCCESS',
          taskId,
        });
      } catch (error) {
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

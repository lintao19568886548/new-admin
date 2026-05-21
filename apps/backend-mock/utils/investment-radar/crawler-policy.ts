import type {
  CrawlerSource,
  DemoCrawlerLead,
  PolicyCheckResult,
} from './crawler-types';

import {
  GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES,
  PUBLIC_EIA_NOTICE_SOURCE_CODE,
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES,
} from './crawler-types';

export const PUBLIC_OPPORTUNITY_99CFW_ALLOWED_HOST = 'www.99cfw.com';
export const PUBLIC_OPPORTUNITY_99CFW_ALLOWED_ORIGIN = 'https://www.99cfw.com';
export const PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATH_PREFIX = '/changfangxuqiu/';
export const PUBLIC_OPPORTUNITY_99CFW_ALLOWED_CITY_PATH_PREFIX = '/xuqiu/';
export const PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS = [
  PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATH_PREFIX,
  PUBLIC_OPPORTUNITY_99CFW_ALLOWED_CITY_PATH_PREFIX,
] as const;
export const PUBLIC_FACTORY_CFZSW68_ALLOWED_HOST = 'cfzsw68.com';
export const PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN = 'http://cfzsw68.com';
export const PUBLIC_FACTORY_CFZSW68_ALLOWED_PATH_PREFIX = '/sz/cfcz/';
export const PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS = [
  PUBLIC_FACTORY_CFZSW68_ALLOWED_PATH_PREFIX,
] as const;

const PUBLIC_OPPORTUNITY_99CFW_DETAIL_PATH_PATTERN =
  /^\/changfangxuqiu\/[\w-]+\.(?:html|htm)$/i;
const PUBLIC_OPPORTUNITY_99CFW_CITY_DETAIL_PATH_PATTERN =
  /^\/xuqiu\/[\w-]+\.(?:html|htm)$/i;
const PUBLIC_FACTORY_CFZSW68_DETAIL_PATH_PATTERN =
  /^\/sz\/cfcz\/[\w-]+\.(?:html|htm)$/i;

function normalizeText(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeList(value: null | string[] | undefined) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];
}

function resolveDemoPath(sourceUrl: string) {
  const trimmed = String(sourceUrl || '').trim();
  if (!trimmed) {
    return '/';
  }
  const demoPrefix = 'demo://';
  if (trimmed.startsWith(demoPrefix)) {
    return `/${trimmed.slice(demoPrefix.length).replace(/^\/+/, '')}`;
  }
  try {
    return new URL(trimmed).pathname || '/';
  } catch {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
}

function pathMatches(pathname: string, patterns: string[]) {
  const normalizedPath = normalizeText(pathname);
  return patterns.some((pattern) => {
    const normalizedPattern = pattern.startsWith('/') ? pattern : `/${pattern}`;
    return normalizedPath.startsWith(normalizedPattern);
  });
}

function isPublicOpportunity99CfwHost(hostname: string) {
  return (
    hostname === PUBLIC_OPPORTUNITY_99CFW_ALLOWED_HOST ||
    hostname.endsWith('.99cfw.com')
  );
}

export function isPublicOpportunity99CfwAllowedPathPolicy(
  paths: null | string[] | undefined,
) {
  const normalizedPaths = normalizeList(paths);
  return (
    normalizedPaths.length === PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS.length &&
    normalizedPaths.every(
      (path, index) => path === PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS[index],
    )
  );
}

export function isPublicFactoryCfzsw68AllowedPathPolicy(
  paths: null | string[] | undefined,
) {
  const normalizedPaths = normalizeList(paths);
  return (
    normalizedPaths.length === PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS.length &&
    normalizedPaths.every(
      (path, index) => path === PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS[index],
    )
  );
}

export function buildPublicOpportunity99CfwUrlPolicyFailureReason(
  sourceUrl: string,
  source?: {
    allowedPathsJson?: null | string[];
    blockedPathsJson?: null | string[];
  },
) {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'https:') {
      return 'URL_PROTOCOL_NOT_ALLOWED';
    }
    if (url.username || url.password) {
      return 'URL_AUTH_NOT_ALLOWED';
    }
    if (!isPublicOpportunity99CfwHost(url.hostname)) {
      return 'URL_HOST_NOT_ALLOWED';
    }
    if (url.port && url.port !== '443') {
      return 'URL_PORT_NOT_ALLOWED';
    }
    if (url.search || url.hash) {
      return 'URL_QUERY_NOT_ALLOWED';
    }
    if (
      !PUBLIC_OPPORTUNITY_99CFW_DETAIL_PATH_PATTERN.test(url.pathname) &&
      !PUBLIC_OPPORTUNITY_99CFW_CITY_DETAIL_PATH_PATTERN.test(url.pathname)
    ) {
      return 'URL_DETAIL_PATH_NOT_ALLOWED';
    }

    const allowedPaths = normalizeList(source?.allowedPathsJson);
    if (
      allowedPaths.length > 0 &&
      !isPublicOpportunity99CfwAllowedPathPolicy(allowedPaths)
    ) {
      return 'SOURCE_PATH_ALLOWLIST_WOULD_BROADEN';
    }
    if (allowedPaths.length > 0 && !pathMatches(url.pathname, allowedPaths)) {
      return 'SOURCE_PATH_NOT_ALLOWED';
    }

    const blockedPaths = normalizeList(source?.blockedPathsJson);
    if (blockedPaths.length > 0 && pathMatches(url.pathname, blockedPaths)) {
      return 'SOURCE_PATH_BLOCKED';
    }

    return null;
  } catch {
    return 'URL_INVALID';
  }
}

export function buildPublicOpportunity99CfwListUrlPolicyFailureReason(
  sourceUrl: string,
) {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'https:') {
      return 'URL_PROTOCOL_NOT_ALLOWED';
    }
    if (url.username || url.password) {
      return 'URL_AUTH_NOT_ALLOWED';
    }
    if (url.hostname !== PUBLIC_OPPORTUNITY_99CFW_ALLOWED_HOST) {
      return 'URL_HOST_NOT_ALLOWED';
    }
    if (url.port && url.port !== '443') {
      return 'URL_PORT_NOT_ALLOWED';
    }
    if (url.search || url.hash) {
      return 'URL_QUERY_NOT_ALLOWED';
    }
    return url.pathname === PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATH_PREFIX
      ? null
      : 'URL_LIST_PATH_NOT_ALLOWED';
  } catch {
    return 'URL_INVALID';
  }
}

export function buildPublicFactoryCfzsw68UrlPolicyFailureReason(
  sourceUrl: string,
  source?: {
    allowedPathsJson?: null | string[];
    blockedPathsJson?: null | string[];
  },
) {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'http:') {
      return 'URL_PROTOCOL_NOT_ALLOWED';
    }
    if (url.username || url.password) {
      return 'URL_AUTH_NOT_ALLOWED';
    }
    if (url.hostname !== PUBLIC_FACTORY_CFZSW68_ALLOWED_HOST) {
      return 'URL_HOST_NOT_ALLOWED';
    }
    if (url.port && url.port !== '80') {
      return 'URL_PORT_NOT_ALLOWED';
    }
    if (url.search || url.hash) {
      return 'URL_QUERY_NOT_ALLOWED';
    }
    if (!PUBLIC_FACTORY_CFZSW68_DETAIL_PATH_PATTERN.test(url.pathname)) {
      return 'URL_DETAIL_PATH_NOT_ALLOWED';
    }

    const allowedPaths = normalizeList(source?.allowedPathsJson);
    if (
      allowedPaths.length > 0 &&
      !isPublicFactoryCfzsw68AllowedPathPolicy(allowedPaths)
    ) {
      return 'SOURCE_PATH_ALLOWLIST_WOULD_BROADEN';
    }
    if (allowedPaths.length > 0 && !pathMatches(url.pathname, allowedPaths)) {
      return 'SOURCE_PATH_NOT_ALLOWED';
    }

    const blockedPaths = normalizeList(source?.blockedPathsJson);
    if (blockedPaths.length > 0 && pathMatches(url.pathname, blockedPaths)) {
      return 'SOURCE_PATH_BLOCKED';
    }

    return null;
  } catch {
    return 'URL_INVALID';
  }
}

export function buildPublicFactoryCfzsw68ListUrlPolicyFailureReason(
  sourceUrl: string,
) {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'http:') {
      return 'URL_PROTOCOL_NOT_ALLOWED';
    }
    if (url.username || url.password) {
      return 'URL_AUTH_NOT_ALLOWED';
    }
    if (url.hostname !== PUBLIC_FACTORY_CFZSW68_ALLOWED_HOST) {
      return 'URL_HOST_NOT_ALLOWED';
    }
    if (url.port && url.port !== '80') {
      return 'URL_PORT_NOT_ALLOWED';
    }
    if (url.search || url.hash) {
      return 'URL_QUERY_NOT_ALLOWED';
    }
    return url.pathname === PUBLIC_FACTORY_CFZSW68_ALLOWED_PATH_PREFIX
      ? null
      : 'URL_LIST_PATH_NOT_ALLOWED';
  } catch {
    return 'URL_INVALID';
  }
}

export function checkCrawlerSourcePolicy(
  source: CrawlerSource,
): PolicyCheckResult {
  if (!source.enabled) {
    return { allowed: false, reason: 'SOURCE_DISABLED' };
  }
  if (source.rateLimitPerMinute <= 0) {
    return { allowed: false, reason: 'RATE_LIMIT_INVALID' };
  }
  if (source.crawlIntervalMinutes < 0) {
    return { allowed: false, reason: 'CRAWL_INTERVAL_INVALID' };
  }
  if (source.sourceType === 'PUBLIC_OPPORTUNITY') {
    if (source.crawlIntervalMinutes <= 0) {
      return { allowed: false, reason: 'CRAWL_INTERVAL_INVALID' };
    }

    if (source.sourceCode === PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE) {
      if (!isPublicOpportunity99CfwAllowedPathPolicy(source.allowedPathsJson)) {
        return {
          allowed: false,
          reason: 'SOURCE_PATH_ALLOWLIST_WOULD_BROADEN',
        };
      }
      return { allowed: true };
    }

    if (source.sourceCode === PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE) {
      if (!isPublicFactoryCfzsw68AllowedPathPolicy(source.allowedPathsJson)) {
        return {
          allowed: false,
          reason: 'SOURCE_PATH_ALLOWLIST_WOULD_BROADEN',
        };
      }
      return { allowed: true };
    }

    if (
      GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES.includes(
        source.sourceCode as any,
      )
    ) {
      return { allowed: true };
    }

    if (
      PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.includes(
        source.sourceCode as any,
      )
    ) {
      return { allowed: true };
    }

    if (source.sourceCode === PUBLIC_EIA_NOTICE_SOURCE_CODE) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'SOURCE_ADAPTER_NOT_FOUND',
    };
  }
  return { allowed: true };
}

export function checkCrawlerIntervalPolicy(
  source: CrawlerSource,
  now = new Date(),
): PolicyCheckResult {
  if (!source.lastCrawledAt || source.crawlIntervalMinutes <= 0) {
    return { allowed: true };
  }
  const lastCrawledAt = new Date(source.lastCrawledAt);
  if (Number.isNaN(lastCrawledAt.getTime())) {
    return { allowed: true };
  }
  const intervalMs = source.crawlIntervalMinutes * 60 * 1000;
  if (now.getTime() - lastCrawledAt.getTime() < intervalMs) {
    return { allowed: false, reason: 'CRAWL_INTERVAL_NOT_REACHED' };
  }
  return { allowed: true };
}

export function checkDemoLeadPolicy(
  source: CrawlerSource,
  lead: DemoCrawlerLead,
): PolicyCheckResult {
  const pathname = resolveDemoPath(lead.sourceUrl);
  const allowedPaths = normalizeList(source.allowedPathsJson);
  const blockedPaths = normalizeList(source.blockedPathsJson);

  if (allowedPaths.length > 0 && !pathMatches(pathname, allowedPaths)) {
    return { allowed: false, reason: 'PATH_NOT_ALLOWED' };
  }
  if (blockedPaths.length > 0 && pathMatches(pathname, blockedPaths)) {
    return { allowed: false, reason: 'PATH_BLOCKED' };
  }

  const searchableText = normalizeText(
    [
      lead.companyName,
      lead.leadTitle,
      lead.summary,
      lead.industryName,
      lead.regionProvince,
      lead.regionCity,
      lead.regionDistrict,
      lead.hitKeywords.join(' '),
      ...lead.evidences.flatMap((item) => [
        item.rawText,
        item.sourceTitle,
        item.matchedKeywords.join(' '),
      ]),
    ].join(' '),
  );
  const includeKeywords = normalizeList(source.keywordIncludeJson);
  const excludeKeywords = normalizeList(source.keywordExcludeJson);
  const regionScopes = normalizeList(source.regionScopeJson);

  if (
    includeKeywords.length > 0 &&
    !includeKeywords.some((keyword) => searchableText.includes(keyword))
  ) {
    return { allowed: false, reason: 'KEYWORD_NOT_INCLUDED' };
  }
  if (excludeKeywords.some((keyword) => searchableText.includes(keyword))) {
    return { allowed: false, reason: 'KEYWORD_EXCLUDED' };
  }
  if (
    regionScopes.length > 0 &&
    !regionScopes.some((region) => searchableText.includes(region))
  ) {
    return { allowed: false, reason: 'REGION_NOT_MATCHED' };
  }

  return { allowed: true };
}

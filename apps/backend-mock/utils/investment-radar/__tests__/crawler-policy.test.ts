import type { CrawlerSource } from '../crawler-types';

import { describe, expect, it } from 'vitest';

import {
  buildPublicFactoryCfzsw68UrlPolicyFailureReason,
  buildPublicOpportunity99CfwUrlPolicyFailureReason,
  checkCrawlerSourcePolicy,
} from '../crawler-policy';

function buildSource(overrides: Partial<CrawlerSource> = {}): CrawlerSource {
  return {
    allowedPathsJson: ['/changfangxuqiu/', '/xuqiu/'],
    baseUrl: 'https://www.99cfw.com',
    blockedPathsJson: null,
    crawlIntervalMinutes: 5,
    enabled: true,
    keywordExcludeJson: null,
    keywordIncludeJson: null,
    rateLimitPerMinute: 10,
    regionScopeJson: null,
    robotsUrl: null,
    sourceCode: 'PUBLIC_OPPORTUNITY_99CFW',
    sourceId: 1,
    sourceName: '99cfw public opportunity URL pilot',
    sourceType: 'PUBLIC_OPPORTUNITY',
    ...overrides,
  };
}

describe('99cfw public opportunity crawler policy', () => {
  it('allows only numeric detail pages under changfangxuqiu', () => {
    const source = buildSource();

    expect(
      buildPublicOpportunity99CfwUrlPolicyFailureReason(
        'https://www.99cfw.com/changfangxuqiu/123456.html',
        source,
      ),
    ).toBeNull();
  });

  it.each([
    ['https://www.99cfw.com/', 'URL_DETAIL_PATH_NOT_ALLOWED'],
    ['https://www.99cfw.com/changfangxuqiu/', 'URL_DETAIL_PATH_NOT_ALLOWED'],
    [
      'https://www.99cfw.com/changfangxuqiu/list.html',
      'URL_DETAIL_PATH_NOT_ALLOWED',
    ],
    [
      'https://www.99cfw.com/changfangxuqiu/index_2.html',
      'URL_DETAIL_PATH_NOT_ALLOWED',
    ],
    ['https://www.99cfw.com/xuqiu/page.html', 'URL_DETAIL_PATH_NOT_ALLOWED'],
    [
      'https://www.99cfw.com/changfangchuzu/123456.html',
      'URL_DETAIL_PATH_NOT_ALLOWED',
    ],
    [
      'https://www.example.com/changfangxuqiu/123456.html',
      'URL_HOST_NOT_ALLOWED',
    ],
    [
      'http://www.99cfw.com/changfangxuqiu/123456.html',
      'URL_PROTOCOL_NOT_ALLOWED',
    ],
    [
      'https://www.99cfw.com/changfangxuqiu/123456.html?from=list',
      'URL_QUERY_NOT_ALLOWED',
    ],
  ])('rejects %s', (sourceUrl, reason) => {
    expect(
      buildPublicOpportunity99CfwUrlPolicyFailureReason(
        sourceUrl,
        buildSource(),
      ),
    ).toBe(reason);
  });

  it('rejects widened source path allowlists', () => {
    expect(
      checkCrawlerSourcePolicy(
        buildSource({ allowedPathsJson: ['/changfangxuqiu/', '/'] }),
      ),
    ).toEqual({
      allowed: false,
      reason: 'SOURCE_PATH_ALLOWLIST_WOULD_BROADEN',
    });
  });

  it('requires a positive crawl interval for public opportunity sources', () => {
    expect(checkCrawlerSourcePolicy(buildSource())).toEqual({ allowed: true });
    expect(
      checkCrawlerSourcePolicy(buildSource({ crawlIntervalMinutes: 0 })),
    ).toEqual({
      allowed: false,
      reason: 'CRAWL_INTERVAL_INVALID',
    });
  });
});

describe('cfzsw68 public factory listing crawler policy', () => {
  it('allows only numeric detail pages under sz cfcz', () => {
    expect(
      buildPublicFactoryCfzsw68UrlPolicyFailureReason(
        'http://cfzsw68.com/sz/cfcz/38967.html',
        buildSource({
          allowedPathsJson: ['/sz/cfcz/'],
          baseUrl: 'http://cfzsw68.com',
          sourceCode: 'PUBLIC_FACTORY_LISTING_CFZSW68',
        }),
      ),
    ).toBeNull();
  });

  it.each([
    ['http://cfzsw68.com/sz/cfcz/', 'URL_DETAIL_PATH_NOT_ALLOWED'],
    [
      'http://cfzsw68.com/sz/cfcz/index_1564.html',
      'URL_DETAIL_PATH_NOT_ALLOWED',
    ],
    ['http://cfzsw68.com/sz/cfcz/list.html', 'URL_DETAIL_PATH_NOT_ALLOWED'],
    ['https://cfzsw68.com/sz/cfcz/38967.html', 'URL_PROTOCOL_NOT_ALLOWED'],
    ['http://www.cfzsw68.com/sz/cfcz/38967.html', 'URL_HOST_NOT_ALLOWED'],
    [
      'http://cfzsw68.com/sz/cfcz/38967.html?from=list',
      'URL_QUERY_NOT_ALLOWED',
    ],
  ])('rejects %s', (sourceUrl, reason) => {
    expect(
      buildPublicFactoryCfzsw68UrlPolicyFailureReason(
        sourceUrl,
        buildSource({
          allowedPathsJson: ['/sz/cfcz/'],
          baseUrl: 'http://cfzsw68.com',
          sourceCode: 'PUBLIC_FACTORY_LISTING_CFZSW68',
        }),
      ),
    ).toBe(reason);
  });
});

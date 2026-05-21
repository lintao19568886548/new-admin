import type { ParsedPublicOpportunity } from './crawler-adapters/types';

import { demand99cfwGuangdongAdapter } from './crawler-adapters/public-demands/demand-99cfw-guangdong-adapter';
import { demandCfzxGuangdongAdapter } from './crawler-adapters/public-demands/demand-cfzx-guangdong-adapter';
import { demandZgzswGuangdongAdapter } from './crawler-adapters/public-demands/demand-zgzsw-guangdong-adapter';
import { listing58GuangdongAdapter } from './crawler-adapters/public-listings/listing-58-guangdong-adapter';
import { listing99cfwGuangdongAdapter } from './crawler-adapters/public-listings/listing-99cfw-guangdong-adapter';
import { listingCangxiaoerGuangdongAdapter } from './crawler-adapters/public-listings/listing-cangxiaoer-guangdong-adapter';
import { listingCfzxGuangdongAdapter } from './crawler-adapters/public-listings/listing-cfzx-guangdong-adapter';
import { listingFangGuangdongAdapter } from './crawler-adapters/public-listings/listing-fang-guangdong-adapter';
import { listingToodcGuangdongAdapter } from './crawler-adapters/public-listings/listing-toodc-guangdong-adapter';
import { extractListingDetailUrlsFromListHtml } from './crawler-adapters/public-listings/listing-url-discovery';
import { listingZgzswGuangdongAdapter } from './crawler-adapters/public-listings/listing-zgzsw-guangdong-adapter';
import {
  buildPublicFactoryCfzsw68ListUrlPolicyFailureReason,
  buildPublicFactoryCfzsw68UrlPolicyFailureReason,
  buildPublicOpportunity99CfwUrlPolicyFailureReason,
  PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN,
  PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS,
  PUBLIC_OPPORTUNITY_99CFW_ALLOWED_ORIGIN,
  PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS,
} from './crawler-policy';
import {
  GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES,
  PUBLIC_DEMAND_PLATFORM_SOURCE_CODES,
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  PUBLIC_FACTORY_LISTING_PLATFORM_SOURCE_CODES,
  PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
} from './crawler-types';

export interface PublicCrawlerAdapter {
  allowedPaths: string[];
  buildListUrl: () => string;
  buildListUrls?: () => string[];
  extractFromHtml?: (
    html: string,
    sourceUrl: string,
  ) => ParsedPublicOpportunity;
  extractDetailUrlsFromListHtml?: (
    html: string,
    listUrl: string,
  ) => Array<{
    publishedAt?: null | string;
    sourceTitle?: null | string;
    sourceUrl: string;
  }>;
  opportunityType: 'DEMAND' | 'SUPPLY';
  platformName?: string;
  sourceCode: string;
  sourceSite: string;
  validateDetailUrl: (
    sourceUrl: string,
    source?: {
      allowedPathsJson?: null | string[];
      blockedPathsJson?: null | string[];
    },
  ) => null | string;
  validateListUrl: (sourceUrl: string) => null | string;
}

interface GenericPublicCrawlerAdapterConfig {
  allowedHosts: string[];
  detailPathPatterns?: RegExp[];
  detailPathPrefixes?: string[];
  listUrls: string[];
  opportunityType: 'DEMAND' | 'SUPPLY';
  sourceCode: string;
  sourceName: string;
  sourceSite: string;
}

export const genericPublicCrawlerAdapterConfigs: GenericPublicCrawlerAdapterConfig[] =
  GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES.map((sourceCode) => {
    const configBySourceCode: Record<
      (typeof GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES)[number],
      GenericPublicCrawlerAdapterConfig
    > = {
      PUBLIC_FACTORY_LISTING_58_DG: {
        allowedHosts: ['www.58.com', 'dg.58.com'],
        detailPathPatterns: [
          /^\/(?:cangku|cangkucf|cfcz|changfang)\/[^?#]+\.(?:shtml|html)$/i,
        ],
        detailPathPrefixes: ['/cangku/', '/cangkucf/', '/cfcz/', '/changfang/'],
        listUrls: [
          'https://www.58.com/dg/cfcz-7-dg/',
          'https://www.58.com/dg/cfcz-9-dg/',
          'https://dg.58.com/cangkucf/',
        ],
        opportunityType: 'SUPPLY',
        sourceCode,
        sourceName: '58 同城东莞厂房仓库房源',
        sourceSite: '58.com',
      },
      PUBLIC_FACTORY_LISTING_99CFW_DG: {
        allowedHosts: ['dg.99cfw.com'],
        detailPathPatterns: [
          /^\/changfang\/[\w-]+\.(?:html|htm)$/i,
          /^\/cangku\/[\w-]+\.(?:html|htm)$/i,
        ],
        detailPathPrefixes: ['/cangku/', '/changfang/'],
        listUrls: [
          'https://dg.99cfw.com/changfang/',
          'https://dg.99cfw.com/cangku/',
        ],
        opportunityType: 'SUPPLY',
        sourceCode,
        sourceName: '99cfw 东莞公开厂房房源',
        sourceSite: '99cfw',
      },
      PUBLIC_FACTORY_LISTING_CANGXIAOER_DG: {
        allowedHosts: [
          'www.cangxiaoer.com',
          'm.cangxiaoer.com',
          'guangdong.cangxiaoer.com',
        ],
        detailPathPatterns: [/^\/d\/(?:cangku|changfang)\/[\w-]+\.html$/i],
        detailPathPrefixes: ['/d/cangku/', '/d/changfang/'],
        listUrls: [
          'https://www.cangxiaoer.com/changfang/cc441900-b1',
          'https://www.cangxiaoer.com/cangku/cc441900-b1',
          'https://guangdong.cangxiaoer.com/',
        ],
        opportunityType: 'SUPPLY',
        sourceCode,
        sourceName: '仓小二东莞厂房仓库房源',
        sourceSite: 'cangxiaoer.com',
      },
      PUBLIC_FACTORY_LISTING_FANG_DG: {
        allowedHosts: ['dg.shop.fang.com'],
        detailPathPatterns: [/^\/[^?#]+(?:\.html|\.htm)$/i],
        detailPathPrefixes: ['/cf/'],
        listUrls: ['https://dg.shop.fang.com/cf/zu/house/'],
        opportunityType: 'SUPPLY',
        sourceCode,
        sourceName: '房天下东莞厂房房源',
        sourceSite: 'fang.com',
      },
      PUBLIC_FACTORY_LISTING_SZAQFDC_DG: {
        allowedHosts: ['dg.szaqfdc.com'],
        detailPathPatterns: [/^\/[^?#]+(?:\.html|\.htm)$/i],
        detailPathPrefixes: ['/cf/', '/changfang/', '/fangyuan/', '/house/'],
        listUrls: ['https://dg.szaqfdc.com/'],
        opportunityType: 'SUPPLY',
        sourceCode,
        sourceName: '安企地产网东莞厂房房源',
        sourceSite: 'szaqfdc.com',
      },
      PUBLIC_FACTORY_LISTING_TOODC_DG: {
        allowedHosts: ['dg.toodc.cn'],
        detailPathPrefixes: ['/map/', '/warehouse/', '/factory/', '/project/'],
        listUrls: ['https://dg.toodc.cn/', 'https://dg.toodc.cn/map/u1'],
        opportunityType: 'SUPPLY',
        sourceCode,
        sourceName: '头等仓东莞厂房仓库房源',
        sourceSite: 'toodc.cn',
      },
    };
    return configBySourceCode[sourceCode];
  });

const importedPublicCrawlerAdapterAllowedPathsBySourceCode: Record<
  string,
  string[]
> = {
  PUBLIC_DEMAND_99CFW_GD: ['/cangkuqiu/', '/changfangxuqiu/'],
  PUBLIC_DEMAND_CFZX_GD: ['/detail/', '/info/', '/xuqiu/'],
  PUBLIC_DEMAND_ZGZSW_GD: ['/detail/', '/info/', '/xuqiu/'],
  PUBLIC_FACTORY_LISTING_CFZX_GD: [
    '/cangku/',
    '/changfang/',
    '/detail/',
    '/info/',
    '/xiezilou/',
  ],
  PUBLIC_FACTORY_LISTING_58_GD: [
    '/cangku/',
    '/cangkucf/',
    '/cfcz/',
    '/changfang/',
    '/fangchan/',
    '/tudi/',
    '/xiezilou/',
  ],
  PUBLIC_FACTORY_LISTING_99CFW_GD: [
    '/cangku/',
    '/changfang/',
    '/tudi/',
    '/xiezilou/',
    '/yuanqu/',
  ],
  PUBLIC_FACTORY_LISTING_CANGXIAOER_GD: [
    '/cangku/',
    '/changfang/',
    '/d/cangku/',
    '/d/changfang/',
    '/park/',
  ],
  PUBLIC_FACTORY_LISTING_FANG_GD: [
    '/cf/',
    '/changfang/',
    '/fangyuan/',
    '/house/',
    '/industrial/',
  ],
  PUBLIC_FACTORY_LISTING_TOODC_GD: [
    '/factory/',
    '/map/',
    '/park/',
    '/project/',
    '/warehouse/',
  ],
  PUBLIC_FACTORY_LISTING_ZGZSW_GD: [
    '/cangku/',
    '/changfang/',
    '/detail/',
    '/info/',
    '/xiezilou/',
  ],
};

const publicOpportunity99CfwGuangdongListUrls =
  demand99cfwGuangdongAdapter.listUrls.filter(
    (listUrl) =>
      listUrl.includes('/changfangxuqiu/') &&
      listUrl !== `${PUBLIC_OPPORTUNITY_99CFW_ALLOWED_ORIGIN}/changfangxuqiu/`,
  );

function getImportedPublicCrawlerAdapterAllowedPaths(sourceCode: string) {
  return importedPublicCrawlerAdapterAllowedPathsBySourceCode[sourceCode] || [];
}

function buildExactListUrlPolicyFailureReason(
  sourceUrl: string,
  allowedListUrls: string[],
) {
  try {
    const url = new URL(sourceUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return 'URL_PROTOCOL_NOT_ALLOWED';
    }
    if (url.username || url.password) {
      return 'URL_AUTH_NOT_ALLOWED';
    }
    if (url.search || url.hash) {
      return 'URL_QUERY_NOT_ALLOWED';
    }
    return allowedListUrls.includes(sourceUrl) ? null : 'URL_LIST_NOT_ALLOWED';
  } catch {
    return 'URL_INVALID';
  }
}

function isGenericHostAllowed(hostname: string, allowedHosts: string[]) {
  return allowedHosts.some(
    (allowedHost) =>
      hostname === allowedHost || hostname.endsWith(`.${allowedHost}`),
  );
}

function genericPathAllowed(
  pathname: string,
  config: GenericPublicCrawlerAdapterConfig,
) {
  const hasPathPatterns = Boolean(config.detailPathPatterns?.length);
  const patternAllowed = Boolean(
    config.detailPathPatterns?.some((pattern) => pattern.test(pathname)),
  );
  const hasPathPrefixes = Boolean(config.detailPathPrefixes?.length);
  const prefixAllowed = Boolean(
    config.detailPathPrefixes?.some((prefix) => pathname.startsWith(prefix)),
  );

  if (hasPathPatterns && !patternAllowed) {
    return false;
  }
  if (hasPathPrefixes && !prefixAllowed) {
    return false;
  }
  return patternAllowed || prefixAllowed;
}

function buildGenericDetailUrlPolicyFailureReason(
  config: GenericPublicCrawlerAdapterConfig,
  sourceUrl: string,
  source?: {
    allowedPathsJson?: null | string[];
    blockedPathsJson?: null | string[];
  },
) {
  try {
    const url = new URL(sourceUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return 'URL_PROTOCOL_NOT_ALLOWED';
    }
    if (url.username || url.password) {
      return 'URL_AUTH_NOT_ALLOWED';
    }
    if (!isGenericHostAllowed(url.hostname, config.allowedHosts)) {
      return 'URL_HOST_NOT_ALLOWED';
    }
    if (!genericPathAllowed(url.pathname, config)) {
      return 'URL_DETAIL_PATH_NOT_ALLOWED';
    }
    const allowedPaths = source?.allowedPathsJson || [];
    if (!allowedPaths.some((path) => url.pathname.startsWith(path))) {
      return 'SOURCE_PATH_NOT_ALLOWED';
    }
    const blockedPaths = source?.blockedPathsJson || [];
    if (blockedPaths.some((path) => url.pathname.startsWith(path))) {
      return 'SOURCE_PATH_BLOCKED';
    }
    return null;
  } catch {
    return 'URL_INVALID';
  }
}

function buildGenericListUrlPolicyFailureReason(
  config: GenericPublicCrawlerAdapterConfig,
  sourceUrl: string,
) {
  try {
    const url = new URL(sourceUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return 'URL_PROTOCOL_NOT_ALLOWED';
    }
    if (url.username || url.password) {
      return 'URL_AUTH_NOT_ALLOWED';
    }
    if (!isGenericHostAllowed(url.hostname, config.allowedHosts)) {
      return 'URL_HOST_NOT_ALLOWED';
    }
    return config.listUrls.includes(sourceUrl) ? null : 'URL_LIST_NOT_ALLOWED';
  } catch {
    return 'URL_INVALID';
  }
}

function buildGenericPublicCrawlerAdapter(
  config: GenericPublicCrawlerAdapterConfig,
): PublicCrawlerAdapter {
  return {
    allowedPaths: [...(config.detailPathPrefixes || [])],
    buildListUrl: () => config.listUrls[0] || '',
    buildListUrls: () => [...config.listUrls],
    opportunityType: config.opportunityType,
    platformName: config.sourceName,
    sourceCode: config.sourceCode,
    sourceSite: config.sourceSite,
    validateDetailUrl: (sourceUrl, source) =>
      buildGenericDetailUrlPolicyFailureReason(config, sourceUrl, source),
    validateListUrl: (sourceUrl) =>
      buildGenericListUrlPolicyFailureReason(config, sourceUrl),
  };
}

function buildImportedPublicCrawlerAdapter(
  adapter:
    | typeof demand99cfwGuangdongAdapter
    | typeof demandCfzxGuangdongAdapter
    | typeof demandZgzswGuangdongAdapter
    | typeof listing58GuangdongAdapter
    | typeof listing99cfwGuangdongAdapter
    | typeof listingCangxiaoerGuangdongAdapter
    | typeof listingCfzxGuangdongAdapter
    | typeof listingFangGuangdongAdapter
    | typeof listingToodcGuangdongAdapter
    | typeof listingZgzswGuangdongAdapter,
): PublicCrawlerAdapter {
  const allowedPaths = getImportedPublicCrawlerAdapterAllowedPaths(
    adapter.sourceCode,
  );
  return {
    allowedPaths: [...allowedPaths],
    buildListUrl: () => adapter.listUrls[0] || '',
    buildListUrls: () => [...adapter.listUrls],
    extractDetailUrlsFromListHtml: (html, listUrl) =>
      'extractDetailUrlsFromListHtml' in adapter &&
      adapter.extractDetailUrlsFromListHtml
        ? adapter.extractDetailUrlsFromListHtml(html, listUrl)
        : extractListingDetailUrlsFromListHtml(html, listUrl, {
            validateDetailUrl: adapter.validateDetailUrl,
          }),
    extractFromHtml: adapter.extractFromHtml,
    opportunityType: adapter.opportunityType,
    platformName: adapter.platformName,
    sourceCode: adapter.sourceCode,
    sourceSite: adapter.sourceSite,
    validateDetailUrl: (sourceUrl, source) => {
      if (!adapter.validateDetailUrl(sourceUrl)) {
        return 'URL_DETAIL_PATH_NOT_ALLOWED';
      }

      try {
        const url = new URL(sourceUrl);
        const allowedPaths = source?.allowedPathsJson || [];
        if (
          allowedPaths.length > 0 &&
          !allowedPaths.some((path) => url.pathname.startsWith(path))
        ) {
          return 'SOURCE_PATH_NOT_ALLOWED';
        }
        const blockedPaths = source?.blockedPathsJson || [];
        if (blockedPaths.some((path) => url.pathname.startsWith(path))) {
          return 'SOURCE_PATH_BLOCKED';
        }
        return null;
      } catch {
        return 'URL_INVALID';
      }
    },
    validateListUrl: (sourceUrl) =>
      adapter.listUrls.includes(sourceUrl) ? null : 'URL_LIST_NOT_ALLOWED',
  };
}

const publicOpportunity99CfwAdapter: PublicCrawlerAdapter = {
  allowedPaths: [...PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS],
  buildListUrl: () => publicOpportunity99CfwGuangdongListUrls[0] || '',
  buildListUrls: () => [...publicOpportunity99CfwGuangdongListUrls],
  opportunityType: 'DEMAND',
  platformName: '99cfw public opportunity demand',
  sourceCode: PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
  sourceSite: '99cfw',
  validateDetailUrl: buildPublicOpportunity99CfwUrlPolicyFailureReason,
  validateListUrl: (sourceUrl) =>
    buildExactListUrlPolicyFailureReason(
      sourceUrl,
      publicOpportunity99CfwGuangdongListUrls,
    ),
};

const publicFactoryCfzsw68Adapter: PublicCrawlerAdapter = {
  allowedPaths: [...PUBLIC_FACTORY_CFZSW68_ALLOWED_PATHS],
  buildListUrl: () => `${PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN}/sz/cfcz/`,
  buildListUrls: () => [`${PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN}/sz/cfcz/`],
  opportunityType: 'SUPPLY',
  platformName: 'cfzsw68 public factory listing',
  sourceCode: PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  sourceSite: 'cfzsw68.com',
  validateDetailUrl: buildPublicFactoryCfzsw68UrlPolicyFailureReason,
  validateListUrl: buildPublicFactoryCfzsw68ListUrlPolicyFailureReason,
};

const adapters = [publicOpportunity99CfwAdapter, publicFactoryCfzsw68Adapter];
const genericAdapters = genericPublicCrawlerAdapterConfigs.map((config) =>
  buildGenericPublicCrawlerAdapter(config),
);
const importedPlatformAdapters = [
  demand99cfwGuangdongAdapter,
  demandCfzxGuangdongAdapter,
  demandZgzswGuangdongAdapter,
  listing58GuangdongAdapter,
  listing99cfwGuangdongAdapter,
  listingCangxiaoerGuangdongAdapter,
  listingCfzxGuangdongAdapter,
  listingFangGuangdongAdapter,
  listingToodcGuangdongAdapter,
  listingZgzswGuangdongAdapter,
].map((adapter) => buildImportedPublicCrawlerAdapter(adapter));
const allAdapters = [
  ...adapters,
  ...genericAdapters,
  ...importedPlatformAdapters,
];

export function getPublicCrawlerAdapter(sourceCode: string) {
  return (
    allAdapters.find((adapter) => adapter.sourceCode === sourceCode) || null
  );
}

export function getPublicCrawlerAdapterAllowedPaths(sourceCode: string) {
  const adapter = getPublicCrawlerAdapter(sourceCode);
  return adapter ? [...adapter.allowedPaths] : null;
}

export function listPublicCrawlerAdapters() {
  return [...allAdapters];
}

export function getGenericPublicCrawlerAdapterConfig(sourceCode: string) {
  return (
    genericPublicCrawlerAdapterConfigs.find(
      (config) => config.sourceCode === sourceCode,
    ) || null
  );
}

export function isRegisteredPublicCrawlerAdapterSourceCode(sourceCode: string) {
  return Boolean(getPublicCrawlerAdapter(sourceCode));
}

export function listImportedPublicCrawlerAdapterSourceCodes() {
  return [
    ...PUBLIC_FACTORY_LISTING_PLATFORM_SOURCE_CODES,
    ...PUBLIC_DEMAND_PLATFORM_SOURCE_CODES,
  ];
}

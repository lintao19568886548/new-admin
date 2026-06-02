import type { ParsedPublicOpportunity } from './crawler-adapters/types';

import { demand99cfwGuangdongAdapter } from './crawler-adapters/public-demands/demand-99cfw-guangdong-adapter';
import { listing99cfwGuangdongAdapter } from './crawler-adapters/public-listings/listing-99cfw-guangdong-adapter';
import { listingCfzsw68Adapter } from './crawler-adapters/public-listings/listing-cfzsw68-adapter';
import { listingFangGuangdongAdapter } from './crawler-adapters/public-listings/listing-fang-guangdong-adapter';
import { listingToodcGuangdongAdapter } from './crawler-adapters/public-listings/listing-toodc-guangdong-adapter';
import { extractListingDetailUrlsFromListHtml } from './crawler-adapters/public-listings/listing-url-discovery';
import {
  buildPublicOpportunity99CfwUrlPolicyFailureReason,
  PUBLIC_OPPORTUNITY_99CFW_ALLOWED_PATHS,
} from './crawler-policy';
import {
  GENERIC_PUBLIC_DEMAND_SOURCE_CODES,
  GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES,
  PUBLIC_DEMAND_PLATFORM_SOURCE_CODES,
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
    crawledAt?: Date,
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
  detailPathBlockedPatterns?: RegExp[];
  detailPathBlockedPrefixes?: string[];
  detailPathPatterns?: RegExp[];
  detailPathPrefixes?: string[];
  listUrls: string[];
  opportunityType: 'DEMAND' | 'SUPPLY';
  sourceCode: string;
  sourceName: string;
  sourceSite: string;
}

type GenericPublicCrawlerSourceCode =
  | (typeof GENERIC_PUBLIC_DEMAND_SOURCE_CODES)[number]
  | (typeof GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES)[number];

const broadListingDetailPattern =
  /^\/(?:[^?#/]+\/)*(?:changfang|cangku|factory|warehouse|property|rent|detail|cf|ck|yuanqu|park|project)[^\d#/?]*\d[-\w]*(?:[^-\w#/?][^\d#/?]*\d[-\w]*)*(?:\.html)?$/i;

const broadListingDetailPrefixes = [
  '/cangku/',
  '/changfang/',
  '/cf/',
  '/ck/',
  '/detail/',
  '/factory/',
  '/park/',
  '/project/',
  '/property/',
  '/rent/',
  '/warehouse/',
  '/yuanqu/',
];

const genericPublicCrawlerAdapterConfigByCode: Record<
  GenericPublicCrawlerSourceCode,
  GenericPublicCrawlerAdapterConfig
> = {
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
    sourceCode: 'PUBLIC_FACTORY_LISTING_99CFW_DG',
    sourceName: '99cfw Dongguan public listings',
    sourceSite: '99cfw',
  },
  PUBLIC_FACTORY_LISTING_FANG_DG: {
    allowedHosts: ['dg.shop.fang.com'],
    detailPathPatterns: [/^\/[^?#]+(?:\.html|\.htm)$/i],
    detailPathPrefixes: ['/cf/'],
    listUrls: ['https://dg.shop.fang.com/cf/zu/house/'],
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_FANG_DG',
    sourceName: 'fang.com Dongguan public listings',
    sourceSite: 'fang.com',
  },
  PUBLIC_FACTORY_LISTING_SZAQFDC_DG: {
    allowedHosts: ['dg.szaqfdc.com'],
    detailPathPatterns: [/^\/[^?#]+(?:\.html|\.htm)$/i],
    detailPathPrefixes: ['/cf/', '/changfang/', '/fangyuan/', '/house/'],
    listUrls: ['https://dg.szaqfdc.com/'],
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_SZAQFDC_DG',
    sourceName: 'szaqfdc Dongguan public listings',
    sourceSite: 'szaqfdc.com',
  },
  PUBLIC_FACTORY_LISTING_TOODC_DG: {
    allowedHosts: ['dg.toodc.cn'],
    detailPathPrefixes: ['/map/', '/warehouse/', '/factory/', '/project/'],
    listUrls: ['https://dg.toodc.cn/', 'https://dg.toodc.cn/map/u1'],
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_TOODC_DG',
    sourceName: 'toodc Dongguan public listings',
    sourceSite: 'toodc.cn',
  },
  PUBLIC_FACTORY_LISTING_TZGD_GD: {
    allowedHosts: ['digitalgd.com.cn', 'heyuan.gov.cn'],
    detailPathPrefixes: ['/bmjy/', '/szgd/tzgdpt/'],
    listUrls: [
      'https://www.digitalgd.com.cn/szgd/tzgdpt/jjfa_tzgdpt.shtml',
      'https://www.heyuan.gov.cn/bmjy/hysswj/tzgg/content/post_598711.html',
    ],
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_TZGD_GD',
    sourceName: 'Investment Guangdong official resources',
    sourceSite: 'digitalgd.com.cn',
  },
  PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD: {
    allowedHosts: ['ttchangfang.com'],
    detailPathPatterns: [/^\/workshop\/\d{6}\/\d+\.(?:html|htm)$/i],
    detailPathPrefixes: ['/workshop/'],
    listUrls: [
      'https://guangdong.ttchangfang.com/',
      'https://guangdong.ttchangfang.com/workshop/list-htm-catid-4.html',
      'https://guangdong.ttchangfang.com/workshop/list-htm-catid-5.html',
    ],
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD',
    sourceName: 'ttchangfang Guangdong listings',
    sourceSite: 'ttchangfang.com',
  },
  PUBLIC_FACTORY_LISTING_GDCFZS_GD: {
    allowedHosts: ['gdcfzs.com'],
    detailPathPatterns: [
      /^\/show_\d+\.(?:html|htm)$/i,
      /^\/(?:property|house|changfang|cangku|factory|warehouse)[_-]?\d+(?:[_-]\d+)*\.(?:html|htm)$/i,
    ],
    detailPathPrefixes: [
      '/cangku/',
      '/changfang/',
      '/factory/',
      '/property',
      '/show_',
      '/warehouse/',
    ],
    listUrls: [
      'https://www.gdcfzs.com/property_list_1_3_0_0_0_0_1.html',
      'https://www.gdcfzs.com/property_list_1_0_0_0_0_0_1.html',
    ],
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_GDCFZS_GD',
    sourceName: 'gdcfzs Guangdong listings',
    sourceSite: 'gdcfzs.com',
  },
  PUBLIC_FACTORY_LISTING_SZCFW_GD: {
    allowedHosts: ['szcfw.com'],
    detailPathPatterns: [broadListingDetailPattern],
    detailPathPrefixes: [...broadListingDetailPrefixes],
    listUrls: [
      'https://www.szcfw.com/',
      'https://www.szcfw.com/changfang/',
      'https://www.szcfw.com/cangku/',
    ],
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_SZCFW_GD',
    sourceName: 'szcfw listings',
    sourceSite: 'szcfw.com',
  },
  PUBLIC_FACTORY_LISTING_SZKKW_GD: {
    allowedHosts: ['szkkw.com'],
    detailPathBlockedPatterns: [
      /^\/shenzhen\/(?:cangku|changfang|shangpu|xiezilou)\/0_0_0_0_\d+\.(?:html|htm)$/i,
    ],
    detailPathPatterns: [broadListingDetailPattern],
    detailPathPrefixes: [
      ...broadListingDetailPrefixes,
      '/shenzhen/cangku/',
      '/shenzhen/changfang/',
      '/shenzhen/gongyeyuanqu/',
      '/shenzhen/xiezilou/',
      '/xiezilou/',
    ],
    listUrls: [
      'https://www.szkkw.com/',
      'https://www.szkkw.com/shenzhen/changfang/0_0_0_0_1.html',
      'https://www.szkkw.com/shenzhen/cangku/0_0_0_0_1.html',
    ],
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_SZKKW_GD',
    sourceName: 'szkkw listings',
    sourceSite: 'szkkw.com',
  },
  PUBLIC_FACTORY_LISTING_HFDPT_GD: {
    allowedHosts: ['hfdpt.com'],
    detailPathPatterns: [
      /^\/show_\d+\.(?:html|htm)$/i,
      /^\/(?:changfang|kufang|tudi|zonghelou)_\d+\.(?:html|htm)$/i,
    ],
    detailPathPrefixes: [
      '/changfang/',
      '/changfang_',
      '/kufang/',
      '/kufang_',
      '/show_',
      '/tudi/',
      '/tudi_',
      '/zonghelou/',
      '/zonghelou_',
    ],
    listUrls: [
      'https://guangdong.hfdpt.com/',
      'https://guangdong.hfdpt.com/changfang/index.html',
      'https://guangdong.hfdpt.com/kufang/index.html',
      'https://guangdong.hfdpt.com/tudi/index.html',
      'https://guangdong.hfdpt.com/zonghelou/index.html',
    ],
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_HFDPT_GD',
    sourceName: 'hfdpt Guangdong listings',
    sourceSite: 'hfdpt.com',
  },
  PUBLIC_FACTORY_LISTING_CHANGFANG88_GD: {
    allowedHosts: ['changfang88.com'],
    detailPathPatterns: [broadListingDetailPattern],
    detailPathPrefixes: [
      ...broadListingDetailPrefixes,
      '/Industry/cangku/',
      '/Industry/changfangchuzu/',
      '/Industry/gongyeyuanqu/',
    ],
    listUrls: [
      'https://www.changfang88.com/',
      'https://www.changfang88.com/Industry/changfangchuzu/',
      'https://www.changfang88.com/Industry/gongyeyuanqu/',
    ],
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_CHANGFANG88_GD',
    sourceName: 'changfang88 listings',
    sourceSite: 'changfang88.com',
  },
  PUBLIC_FACTORY_LISTING_YSOL_GD: {
    allowedHosts: ['ysol.com'],
    detailPathPatterns: [
      /^\/fangyuan\/[A-Z0-9]{16}\.(?:html|htm)$/i,
      /^\/park\/(?!qu\d+\.(?:html|htm)$)[A-Z0-9]{16}\.(?:html|htm)$/i,
      /^\/shangji\/[A-Z0-9]{16}\.(?:html|htm)$/i,
    ],
    detailPathPrefixes: ['/fangyuan/', '/park/', '/shangji/'],
    listUrls: ['https://www.ysol.com/fangyuan/', 'https://www.ysol.com/park/'],
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_YSOL_GD',
    sourceName: 'ysol park and factory listings',
    sourceSite: 'ysol.com',
  },
  PUBLIC_DEMAND_ZHAOSHANG_NET_GD: {
    allowedHosts: ['gd.zhaoshang.net'],
    detailPathPatterns: [/^\/item\/detail\/\d+\.(?:html|htm)$/i],
    detailPathPrefixes: ['/item/detail/'],
    listUrls: ['https://gd.zhaoshang.net/item'],
    opportunityType: 'DEMAND',
    sourceCode: 'PUBLIC_DEMAND_ZHAOSHANG_NET_GD',
    sourceName: 'zhaoshang.net public demands',
    sourceSite: 'zhaoshang.net',
  },
};

export const genericPublicCrawlerAdapterConfigs: GenericPublicCrawlerAdapterConfig[] =
  [
    ...GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES,
    ...GENERIC_PUBLIC_DEMAND_SOURCE_CODES,
  ].map((sourceCode) => genericPublicCrawlerAdapterConfigByCode[sourceCode]);

const importedPublicCrawlerAdapterAllowedPathsBySourceCode: Record<
  string,
  string[]
> = {
  PUBLIC_DEMAND_99CFW_GD: ['/cangkuqiu/', '/changfangxuqiu/', '/xuqiu/'],
  PUBLIC_FACTORY_LISTING_99CFW_GD: [
    '/cangku/',
    '/changfang/',
    '/tudi/',
    '/xiezilou/',
    '/yuanqu/',
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
};

const publicOpportunity99CfwGuangdongListUrls =
  demand99cfwGuangdongAdapter.listUrls;

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
    if (url.hash) {
      return 'URL_QUERY_NOT_ALLOWED';
    }
    return allowedListUrls.some((allowedListUrl) => {
      const allowedUrl = new URL(allowedListUrl);
      return (
        url.origin === allowedUrl.origin &&
        url.pathname.startsWith(allowedUrl.pathname)
      );
    })
      ? null
      : 'URL_LIST_NOT_ALLOWED';
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
  if (
    config.detailPathBlockedPatterns?.some((pattern) =>
      pattern.test(pathname),
    ) ||
    config.detailPathBlockedPrefixes?.some((prefix) =>
      pathname.startsWith(prefix),
    )
  ) {
    return false;
  }

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
    return config.listUrls.some((listUrl) => {
      const allowedUrl = new URL(listUrl);
      return (
        url.origin === allowedUrl.origin &&
        url.pathname.startsWith(allowedUrl.pathname)
      );
    })
      ? null
      : 'URL_LIST_NOT_ALLOWED';
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
    | typeof listing99cfwGuangdongAdapter
    | typeof listingCfzsw68Adapter
    | typeof listingFangGuangdongAdapter
    | typeof listingToodcGuangdongAdapter,
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
      adapter.validateListUrl?.(sourceUrl) ||
      buildExactListUrlPolicyFailureReason(sourceUrl, adapter.listUrls),
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
    demand99cfwGuangdongAdapter.validateListUrl?.(sourceUrl) ||
    buildExactListUrlPolicyFailureReason(
      sourceUrl,
      publicOpportunity99CfwGuangdongListUrls,
    ),
};

const publicFactoryCfzsw68Adapter = buildImportedPublicCrawlerAdapter(
  listingCfzsw68Adapter,
);

const adapters = [publicOpportunity99CfwAdapter, publicFactoryCfzsw68Adapter];
const genericAdapters = genericPublicCrawlerAdapterConfigs.map((config) =>
  buildGenericPublicCrawlerAdapter(config),
);
const importedPlatformAdapters = [
  demand99cfwGuangdongAdapter,
  listing99cfwGuangdongAdapter,
  listingCfzsw68Adapter,
  listingFangGuangdongAdapter,
  listingToodcGuangdongAdapter,
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

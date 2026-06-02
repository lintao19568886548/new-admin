import type { PublicDemandCrawlerAdapter } from './types';

import { isAllowedHost } from '../public-parser-utils';
import { buildPublicDemandOpportunity } from './demand-parser';

const GUANGDONG_99CFW_HOST_PATTERN =
  /^(?:www|dg|gz|sz|fs|zs|zh|jm|zq|sg|st|zj|mm|mz|sw|hy|yj|qy|jy|yf)\.99cfw\.com$/i;
const GUANGDONG_99CFW_CITY_PATH_PATTERN =
  /^\/changfangxuqiu\/3929(?:gz|sg|sz|zh|st|fs|jiangmen|zj|mm|zq|huizhou|mz|sw|heyuan|yj|qingyuan|dg|zs|chaozhou|jieyang|yf|taishan|sd)\/?$/i;

const GUANGDONG_99CFW_CITY_CODES = [
  'dg',
  'gz',
  'sz',
  'fs',
  'zs',
  'zh',
  'jm',
  'zq',
  'sg',
  'st',
  'zj',
  'mm',
  'mz',
  'sw',
  'hy',
  'yj',
  'qy',
  'jy',
  'yf',
] as const;

const GUANGDONG_99CFW_CITY_SLUGS = [
  'gz',
  'sg',
  'sz',
  'zh',
  'st',
  'fs',
  'jiangmen',
  'zj',
  'mm',
  'zq',
  'huizhou',
  'mz',
  'sw',
  'heyuan',
  'yj',
  'qingyuan',
  'dg',
  'zs',
  'chaozhou',
  'jieyang',
  'yf',
  'taishan',
  'sd',
] as const;

const GUANGDONG_99CFW_CITY_CODE_SET = new Set<string>(
  GUANGDONG_99CFW_CITY_CODES,
);

const GUANGDONG_99CFW_CITY_SLUG_SET = new Set<string>(
  GUANGDONG_99CFW_CITY_SLUGS,
);

const DEMAND_PREFIXES = new Set(['cangkuqiu', 'changfangxuqiu', 'xuqiu']);

const NON_DETAIL_99CFW_SLUGS = new Set([
  'add',
  'apply',
  'fabu',
  'fabuqiuzu',
  'form',
  'free',
  'index',
  'list',
  'more',
  'page',
  'post',
  'publish',
  'release',
  'search',
  'submit',
]);

const PROVINCE_LIST_PAGE_COUNT = 8;

function buildProvincePagedListUrls(regionToken: string) {
  return Array.from({ length: PROVINCE_LIST_PAGE_COUNT }, (_, index) => {
    const page = index + 1;
    return page === 1
      ? `https://www.99cfw.com/changfangxuqiu/${regionToken}/`
      : `https://www.99cfw.com/changfangxuqiu/0_0_0_0_${page}/${regionToken}/`;
  });
}

function build99CfwDemandListUrls() {
  return [
    ...buildProvincePagedListUrls('3929'),
    'https://www.99cfw.com/changfangxuqiu/0_1_0_0_0/3929/',
    'https://www.99cfw.com/changfangxuqiu/0_3_0_0_0/3929/',
    ...GUANGDONG_99CFW_CITY_SLUGS.flatMap((slug) =>
      buildProvincePagedListUrls(`3929${slug}`),
    ),
    ...GUANGDONG_99CFW_CITY_CODES.flatMap((code) => [
      `https://${code}.99cfw.com/xuqiu/`,
      `https://${code}.99cfw.com/xuqiu/0_1_0_0_0/`,
      `https://${code}.99cfw.com/xuqiu/0_3_0_0_0/`,
    ]),
  ];
}

function isFiveSegmentNumberPath(value: string) {
  return value.split('_').length === 5 && /^\d+(?:_\d+)*$/.test(value);
}

function getPathSegments(pathname: string) {
  return pathname
    .split('/')
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
}

function stripHtmlSuffix(value: string) {
  return value.replace(/\.(?:html|htm)$/i, '');
}

function isGuangdong99CfwRegionToken(value: string) {
  const regionToken = stripHtmlSuffix(value);
  return (
    GUANGDONG_99CFW_CITY_CODE_SET.has(regionToken) ||
    GUANGDONG_99CFW_CITY_SLUG_SET.has(regionToken)
  );
}

function isLikely99CfwDemandDetailSlug(value: string) {
  const slug = stripHtmlSuffix(value);
  if (!slug || NON_DETAIL_99CFW_SLUGS.has(slug)) {
    return false;
  }
  if (/^3929[a-z]*$/i.test(slug)) {
    return false;
  }
  if (/^(?:p|page|list)[-_]?\d+$/i.test(slug)) {
    return false;
  }
  if (isFiveSegmentNumberPath(slug)) {
    return false;
  }
  return /^[\w-]{2,120}$/.test(slug);
}

function is99CfwProvinceDemandListPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'changfangxuqiu') {
    return false;
  }
  if (segments.length === 2) {
    return /^3929[a-z]*$/i.test(segments[1] || '');
  }
  return (
    segments.length === 3 &&
    isFiveSegmentNumberPath(segments[1] || '') &&
    /^3929[a-z]*$/i.test(segments[2] || '')
  );
}

function is99CfwCityDemandListPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1) {
    return ['changfangxuqiu', 'xuqiu'].includes(segments[0] || '');
  }
  return (
    segments.length === 2 &&
    segments[0] === 'xuqiu' &&
    isFiveSegmentNumberPath(segments[1] || '')
  );
}

function validate99CfwDemandListUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'https:') {
      return 'URL_PROTOCOL_NOT_ALLOWED';
    }
    if (url.username || url.password) {
      return 'URL_AUTH_NOT_ALLOWED';
    }
    if (!GUANGDONG_99CFW_HOST_PATTERN.test(url.hostname)) {
      return 'URL_HOST_NOT_ALLOWED';
    }
    if (url.search || url.hash) {
      return 'URL_QUERY_NOT_ALLOWED';
    }
    if (/\.(?:html|htm)$/i.test(url.pathname)) {
      return 'URL_DETAIL_PATH_NOT_ALLOWED';
    }
    if (
      url.hostname === 'www.99cfw.com' &&
      is99CfwProvinceDemandListPath(url.pathname)
    ) {
      return null;
    }
    if (
      url.hostname !== 'www.99cfw.com' &&
      is99CfwCityDemandListPath(url.pathname)
    ) {
      return null;
    }
    return 'URL_LIST_PATH_NOT_ALLOWED';
  } catch {
    return 'URL_INVALID';
  }
}

function isCleanPublicDemandDetailUrl(url: URL) {
  return (
    ['http:', 'https:'].includes(url.protocol) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  );
}

function is99CfwDemandDetailPath(hostname: string, pathname: string) {
  if (
    is99CfwProvinceDemandListPath(pathname) ||
    is99CfwCityDemandListPath(pathname) ||
    GUANGDONG_99CFW_CITY_PATH_PATTERN.test(pathname)
  ) {
    return false;
  }

  const [prefix, secondSegment, thirdSegment, ...extraSegments] =
    getPathSegments(pathname);
  if (
    !prefix ||
    !secondSegment ||
    extraSegments.length > 0 ||
    !DEMAND_PREFIXES.has(prefix)
  ) {
    return false;
  }

  if (thirdSegment) {
    return (
      isGuangdong99CfwRegionToken(secondSegment) &&
      isLikely99CfwDemandDetailSlug(thirdSegment)
    );
  }

  return (
    /\.(?:html|htm)$/i.test(secondSegment) &&
    isLikely99CfwDemandDetailSlug(secondSegment)
  );
}

export const demand99cfwGuangdongAdapter: PublicDemandCrawlerAdapter = {
  extractFromHtml: (html, sourceUrl, crawledAt) =>
    buildPublicDemandOpportunity({
      crawledAt,
      html,
      sourceSite: '99cfw',
      sourceUrl,
    }),
  listUrls: build99CfwDemandListUrls(),
  opportunityType: 'DEMAND',
  platformName: '99厂房网广东需求',
  sourceCode: 'PUBLIC_DEMAND_99CFW_GD',
  sourceSite: '99cfw',
  validateDetailUrl: (sourceUrl) => {
    if (!isAllowedHost(sourceUrl, ['99cfw.com'])) {
      return false;
    }
    try {
      const url = new URL(sourceUrl);
      const { hostname, pathname } = url;
      if (!isCleanPublicDemandDetailUrl(url)) {
        return false;
      }
      if (!GUANGDONG_99CFW_HOST_PATTERN.test(hostname)) {
        return false;
      }
      return is99CfwDemandDetailPath(hostname, pathname);
    } catch {
      return false;
    }
  },
  validateListUrl: validate99CfwDemandListUrl,
};

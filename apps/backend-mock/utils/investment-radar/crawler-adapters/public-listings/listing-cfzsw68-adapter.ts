import type { ParsedPublicOpportunity } from '../types';
import type { PublicListingCrawlerAdapter } from './types';

import {
  buildPublicFactoryCfzsw68ListUrlPolicyFailureReason,
  buildPublicFactoryCfzsw68UrlPolicyFailureReason,
  CFZSW68_CITY_PATH_PREFIXES,
  PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN,
} from '../../crawler-policy';
import { normalizeGuangdongCity } from '../../guangdong-public-scope';
import {
  buildDetailJson,
  cleanText,
  collectMissingFields,
  normalizePublishedAt,
} from '../public-parser-utils';
import { extractListingDetailUrlsFromListHtml } from './listing-url-discovery';

const REQUIRED_DETAIL_FIELDS = [
  'title',
  'city',
  'district',
  'areaText',
  'priceText',
  'contactName',
  'phoneNumber',
  'publishedDateText',
];

const CFZSW68_URL_CITY_MAP: Record<string, string> = {
  sz: '深圳',
  dg: '东莞',
  gz: '广州',
  fs: '佛山',
  zs: '中山',
  jm: '江门',
};

function extractCityFromUrl(sourceUrl: string): null | string {
  try {
    const match = new URL(sourceUrl).pathname.match(/^\/(\w+)\/cfcz\//);
    const code = match?.[1];
    return code ? (CFZSW68_URL_CITY_MAP[code] ?? null) : null;
  } catch {
    return null;
  }
}

const SHENZHEN_DISTRICT_NAMES = [
  '福田',
  '罗湖',
  '南山',
  '宝安',
  '龙岗',
  '龙华',
  '坪山',
  '光明',
  '盐田',
  '大鹏',
  '新安',
  '西乡',
  '航城',
  '福永',
  '福海',
  '沙井',
  '新桥',
  '松岗',
  '燕罗',
  '石岩',
  '坂田',
  '布吉',
  '平湖',
  '横岗',
  '坪地',
  '南湾',
  '吉华',
  '园山',
  '宝龙',
  '民治',
  '大浪',
  '观湖',
  '观澜',
  '福城',
  '坑梓',
  '马峦',
  '碧岭',
  '石井',
  '龙田',
  '公明',
  '凤凰',
  '玉塘',
  '马田',
  '新湖',
  '葵涌',
  '南澳',
];

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&ensp;', ' ')
    .replaceAll('&emsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll(/&#x([\da-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    );
}

function compactText(value: null | string | undefined) {
  return cleanText(decodeHtmlEntities(value || ''))
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function normalizeLabelText(value: null | string | undefined) {
  return compactText(value)
    .replaceAll('：', ':')
    .replaceAll(/\s*:\s*/g, ':')
    .trim();
}

function extractFirstMatch(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = compactText(match?.[1]);
    if (value) {
      return value;
    }
  }
  return null;
}

function extractElementInnerHtmlByClass(
  html: string,
  tagName: 'div' | 'ul',
  className: string,
) {
  const tagPattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>`, 'gi');
  for (const match of html.matchAll(tagPattern)) {
    const tag = match[0];
    const classValue = tag.match(/\sclass\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!classValue?.split(/\s+/).includes(className)) {
      continue;
    }

    const contentStart = (match.index || 0) + tag.length;
    const contentEnd = html.indexOf(`</${tagName}>`, contentStart);
    if (contentEnd <= contentStart) {
      return null;
    }
    return html.slice(contentStart, contentEnd);
  }
  return null;
}

function extractBalancedElementInnerHtmlByClass(
  html: string,
  tagName: 'div' | 'ul',
  className: string,
) {
  const tagPattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>`, 'gi');
  for (const match of html.matchAll(tagPattern)) {
    const tag = match[0];
    const classValue = tag.match(/\sclass\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!classValue?.split(/\s+/).includes(className)) {
      continue;
    }

    let depth = 1;
    const cursor = (match.index || 0) + tag.length;
    const nestedTagPattern = new RegExp(`</?${tagName}\\b[^>]*>`, 'gi');
    nestedTagPattern.lastIndex = cursor;
    for (const nestedMatch of html.matchAll(nestedTagPattern)) {
      if (!nestedMatch.index || nestedMatch.index < cursor) {
        continue;
      }
      const nestedTag = nestedMatch[0];
      if (nestedTag.startsWith('</')) {
        depth -= 1;
        if (depth === 0) {
          return html.slice(cursor, nestedMatch.index);
        }
      } else if (!nestedTag.endsWith('/>')) {
        depth += 1;
      }
    }
  }
  return null;
}

function extractTextFromClassBlock(
  html: string,
  tagName: 'div' | 'ul',
  className: string,
) {
  return compactText(
    extractBalancedElementInnerHtmlByClass(html, tagName, className) ||
      extractElementInnerHtmlByClass(html, tagName, className),
  );
}

function normalizeTitle(value: null | string) {
  return (
    value
      ?.replaceAll(/^\[[^\]]+\]\s*[-－]?\s*/gu, '')
      .replaceAll(/\s*[-_|].*(?:厂房招商网|cfzsw68).*$/giu, '')
      .trim() || null
  );
}

function extractTitle(html: string) {
  return normalizeTitle(
    extractTextFromClassBlock(html, 'div', 'listcontwo_1') ||
      extractFirstMatch(html, [
        /<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
        /<title\b[^>]*>([\s\S]*?)<\/title>/i,
      ]),
  );
}

function normalizeAreaText(value: null | string) {
  if (!value) {
    return null;
  }
  const match = value.match(
    /\d[\d,.]*(?:\s*[~\-至到]\s*\d[\d,.]*)?\s*(?:万\s*)?(?:平方米|平米|平方|m²|m2|[㎡亩平])/iu,
  );
  return match?.[0]?.trim() || null;
}

function normalizeAreaSqm(areaText: null | string) {
  if (!areaText || /[~\-至到]/u.test(areaText)) {
    return null;
  }
  const match = areaText
    .replaceAll(/\s+/g, '')
    .match(/(\d[\d,.]*)(万)?(?:平方米|平米|平方|m²|m2|㎡|平)/iu);
  if (!match?.[1]) {
    return null;
  }
  const value = Number(match[1].replaceAll(',', ''));
  if (!Number.isFinite(value)) {
    return null;
  }
  return value * (match[2] ? 10_000 : 1);
}

function normalizePriceText(value: null | string) {
  if (!value) {
    return null;
  }
  if (/面议|电议|价格面谈|价格可面议/u.test(value)) {
    return value.match(/价格可面议|价格面谈|面议|电议/u)?.[0] || null;
  }
  const match = value.match(
    /\d[\d,.]*(?:\s*万)?\s*(?:元\/㎡\/月|元\/平米\/月|元\/平方米\/月|块钱|[元块¥￥])(?:\s*(?:[/.／·・]\s*)?(?:m²|m2|平方米|平米|平方|[㎡亩平月天日年]))*/iu,
  );
  return match?.[0]?.trim() || null;
}

function normalizePhoneNumber(value: null | string) {
  const match = value?.match(/((?:\+?86[-\s]?)?1[3-9]\d(?:[-\s]?\d){8})/);
  const phone = match?.[1]?.replaceAll(/[-\s]/g, '');
  return phone && /^1[3-9]\d{9}$/.test(phone) ? phone : null;
}

function normalizeContactName(
  value: null | string,
  phoneNumber: null | string,
) {
  const contact = value
    ?.replaceAll(phoneNumber || '', ' ')
    .replaceAll(/服务热线|全国客服热线|电话|手机|联系|咨询/g, ' ')
    .replaceAll(/[：:，,;；|｜/\\]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  return contact &&
    /^[\u4E00-\u9FA5A-Za-z]{1,12}(?:先生|女士|经理|总)?$/u.test(contact)
    ? contact
    : null;
}

function extractPublishedDateText(html: string) {
  const text = extractTextFromClassBlock(html, 'div', 'listcontwo_2');
  return (
    text
      ?.match(/\d+\s*(?:分钟|小时|[天日周月年])前/u)?.[0]
      ?.replaceAll(/\s+/g, '') ||
    text?.match(
      /20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/u,
    )?.[0] ||
    text?.match(/\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2})?/u)?.[0] ||
    null
  );
}

function extractMetricsBlock(html: string) {
  return (
    extractTextFromClassBlock(html, 'ul', 'listconn_3_Rr_b') ||
    normalizeLabelText(
      extractBalancedElementInnerHtmlByClass(html, 'div', 'listcontwo_a') ||
        extractBalancedElementInnerHtmlByClass(html, 'div', 'listcontwo'),
    )
  );
}

function extractRegion(
  metricsText: null | string,
  title: null | string,
  sourceUrl: string,
) {
  const regionText =
    metricsText?.match(
      /所在区域[:：]?\s*([\u4E00-\u9FA5A-Za-z0-9\-\s]{1,60})(?:面积|租金|楼层|结构|$)/u,
    )?.[1] ||
    title ||
    null;
  const urlCity = extractCityFromUrl(sourceUrl);
  const stripPattern = urlCity ? new RegExp(`${urlCity}市?`, 'g') : /深圳市?/g;
  const normalizedRegionText = regionText?.replace(stripPattern, '') || '';
  const district =
    SHENZHEN_DISTRICT_NAMES.find((name) =>
      normalizedRegionText.includes(name),
    ) || null;

  return {
    city: urlCity
      ? normalizeGuangdongCity(urlCity)
      : normalizeGuangdongCity(regionText),
    district,
  };
}

function extractAreaText(metricsText: null | string, title: null | string) {
  const labeled =
    metricsText?.match(
      /面积[:：]?\s*(\d[\d,.]*(?:\s*[~\-至到]\s*\d[\d,.]*)?\s*(?:万\s*)?(?:平方米|平米|平方|m²|m2|[㎡亩平])?)/iu,
    )?.[1] || null;
  return normalizeAreaText(labeled) || normalizeAreaText(title);
}

function extractPriceText(metricsText: null | string, title: null | string) {
  const labeled =
    metricsText?.match(/(?:租金|报价|价格)[:：]?([^\n\r。；;]{0,80})/u)?.[1] ||
    null;
  const titlePriceText =
    title?.match(/(?:租金|报价|价格)[^，,。；;\s]{0,20}/u)?.[0] || null;
  return normalizePriceText(labeled) || normalizePriceText(titlePriceText);
}

function extractContact(html: string) {
  const detailText = normalizeLabelText(
    extractBalancedElementInnerHtmlByClass(html, 'div', 'listcontwo_a') ||
      extractBalancedElementInnerHtmlByClass(html, 'div', 'listcontwo') ||
      '',
  );
  const contactText =
    extractTextFromClassBlock(html, 'div', 'listconn_3_R_d') ||
    detailText.match(
      /(?:电话|手机|服务热线|联系人|联系方式|联系|咨询)[:：]?([^。；;|]{0,60})/u,
    )?.[1] ||
    detailText;
  const phoneNumber = normalizePhoneNumber(contactText);
  return {
    contactName: normalizeContactName(contactText, phoneNumber),
    phoneNumber,
  };
}

export function extractCfzsw68ListingFromHtml(
  html: string,
  sourceUrl: string,
): ParsedPublicOpportunity {
  const title = extractTitle(html);
  const metricsText = extractMetricsBlock(html);
  const areaText = extractAreaText(metricsText, title);
  const priceText = extractPriceText(metricsText, title);
  const publishedDateText = extractPublishedDateText(html);
  const { city, district } = extractRegion(metricsText, title, sourceUrl);
  const { contactName, phoneNumber } = extractContact(html);
  const result = {
    areaSqm: normalizeAreaSqm(areaText),
    areaText,
    city,
    contactName,
    description: compactText(html).slice(0, 2000) || null,
    detailJson: buildDetailJson(html, [], publishedDateText),
    district,
    industryText: null,
    missingFields: [] as string[],
    opportunityType: 'SUPPLY' as const,
    phoneNumber,
    priceText,
    publishedAt: normalizePublishedAt(publishedDateText),
    publishedDateText,
    sourceSite: 'cfzsw68.com',
    sourceUrl,
    title,
  };
  const missingFields = collectMissingFields(result, REQUIRED_DETAIL_FIELDS);

  return {
    ...result,
    detailJson: buildDetailJson(html, missingFields, publishedDateText),
    missingFields,
  };
}

export const listingCfzsw68Adapter: PublicListingCrawlerAdapter = {
  extractDetailUrlsFromListHtml: (html, listUrl) =>
    extractListingDetailUrlsFromListHtml(html, listUrl, {
      validateDetailUrl: (sourceUrl) =>
        listingCfzsw68Adapter.validateDetailUrl(sourceUrl),
    }),
  extractFromHtml: extractCfzsw68ListingFromHtml,
  listUrls: CFZSW68_CITY_PATH_PREFIXES.map(
    (prefix) => `${PUBLIC_FACTORY_CFZSW68_ALLOWED_ORIGIN}${prefix}`,
  ),
  opportunityType: 'SUPPLY',
  platformName: 'cfzsw68 public factory listing',
  sourceCode: 'PUBLIC_FACTORY_LISTING_CFZSW68',
  sourceSite: 'cfzsw68.com',
  validateDetailUrl: (sourceUrl) =>
    !buildPublicFactoryCfzsw68UrlPolicyFailureReason(sourceUrl),
  validateListUrl: buildPublicFactoryCfzsw68ListUrlPolicyFailureReason,
};

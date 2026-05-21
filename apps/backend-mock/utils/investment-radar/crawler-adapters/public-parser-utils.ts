import type { GuangdongCityName } from '../guangdong-public-scope';

import { normalizeGuangdongCity } from '../guangdong-public-scope';
import {
  buildResponseHash,
  parsePublicPublishedAt,
} from '../public-opportunity-quality';

const CITY_CODE_MAP: Record<string, GuangdongCityName> = {
  dg: '东莞',
  fs: '佛山',
  gz: '广州',
  hz: '惠州',
  jm: '江门',
  sz: '深圳',
  zh: '珠海',
  zq: '肇庆',
  zs: '中山',
};

export function cleanText(value: null | string | undefined) {
  return String(value || '')
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

export function extractFirstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

export function extractTitle(html: string) {
  const title = extractFirstMatch(html, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ]);
  return title ? cleanText(title).replaceAll(/\s*[-_|].*$/g, '') : null;
}

export function extractCity(text: string, sourceUrl: string) {
  const cityFromText = normalizeGuangdongCity(text);
  if (cityFromText) {
    return cityFromText;
  }

  try {
    const url = new URL(sourceUrl);
    const hostPrefix = url.hostname.split('.')[0] || '';
    return CITY_CODE_MAP[hostPrefix] || null;
  } catch {
    return null;
  }
}

export function extractDistrict(text: string) {
  return (
    extractFirstMatch(text, [
      /(?:区域|地区|位置|地址|所在地|所在区域|所属镇区)[:：\s]*[\u4E00-\u9FA5]{0,12}?([\u4E00-\u9FA5]{2,8}(?:区|镇|街道))/,
      /([\u4E00-\u9FA5]{2,8}(?:区|镇|街道))/,
    ]) || null
  );
}

function extractMeasureText(text: string, labels: string[], units: string[]) {
  const labelIndex = labels
    .map((label) => text.indexOf(label))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  const scope =
    labelIndex === undefined ? text : text.slice(labelIndex, labelIndex + 80);
  const match = scope.match(/\d[0-9.,]*\s*(?:万\s*)?[\u4E00-\u9FA5/㎡²]+/);
  if (!match) {
    return null;
  }
  const value = match[0].trim();
  return units.some((unit) => value.includes(unit)) ? value : null;
}

export function extractAreaText(text: string) {
  return extractMeasureText(
    text,
    ['面积', '建筑面积', '使用面积', '需求面积', '求租面积', '求购面积'],
    ['平方米', '平米', '㎡', 'm²', 'm2'],
  );
}

export function extractPriceText(text: string) {
  return extractMeasureText(
    text,
    ['租金', '租价', '价格', '单价', '预算', '总价预算', '投资预算'],
    ['元', '万', '亿'],
  );
}

export function extractContactName(text: string) {
  return (
    extractFirstMatch(text, [
      /(?:联系人|联系人姓名|负责人|对接人|经纪人|姓名)[:：\s]*([\u4E00-\u9FA5]{2,4})/,
    ]) || null
  );
}

export function extractIndustryText(text: string) {
  const industries = [
    '电子信息',
    '电子制造',
    '电子',
    '五金加工',
    '五金',
    '金属加工',
    '塑胶',
    '塑料',
    '注塑',
    '机械设备',
    '机械制造',
    '机械',
    '服装纺织',
    '服装',
    '纺织',
    '食品加工',
    '食品',
    '化工',
    '物流仓储',
    '物流',
    '仓储',
    '电商',
    '生物医药',
    '医疗器械',
    '新能源',
    '光伏',
    '锂电池',
    '半导体',
    '芯片',
    '智能制造',
    '自动化',
    '新材料',
  ];

  return industries.find((industry) => text.includes(industry)) || null;
}

export function extractPhoneNumber(text: string) {
  return (
    extractFirstMatch(text, [
      /((?:\+?86[-\s]?)?1[3-9]\d{9})/,
      /((?:0\d{2,3}-?)?\d{7,8})/,
      /(400-?\d{3}-?\d{4})/,
    ]) || null
  );
}

function extractAbsoluteDateText(text: string) {
  const match = text.match(
    /20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/,
  );
  return match?.[0] || null;
}

export function extractPublishedDateText(text: string) {
  return (
    extractFirstMatch(text, [/(\d+\s*(?:分钟|小时|[天日周月年])前)/]) ||
    extractAbsoluteDateText(text) ||
    null
  );
}

export function normalizePublishedAt(
  publishedDateText: null | string,
  crawledAt = new Date(),
) {
  const parsed = parsePublicPublishedAt(publishedDateText, crawledAt);
  return parsed ? parsed.toISOString() : null;
}

export function collectMissingFields(
  input: Record<string, unknown>,
  requiredFields: string[],
) {
  return requiredFields.filter((field) => !String(input[field] || '').trim());
}

export function buildDetailJson(
  html: string,
  missingFields: string[],
  publishedDateText: null | string,
) {
  return {
    extractionPolicy: 'STRICT_DETAIL_PAGE_LABELS_ONLY' as const,
    missingFields,
    publishedDateTextRaw: publishedDateText,
    responseHash: buildResponseHash(html),
  };
}

export function isAllowedHost(sourceUrl: string, allowedHosts: string[]) {
  try {
    const url = new URL(sourceUrl);
    return allowedHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

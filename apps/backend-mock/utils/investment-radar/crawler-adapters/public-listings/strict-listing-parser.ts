import type { ParsedPublicOpportunity } from '../types';

import {
  GUANGDONG_CITY_NAMES,
  normalizeGuangdongCity,
} from '../../guangdong-public-scope';
import {
  buildDetailJson,
  cleanText,
  collectMissingFields,
  normalizePublishedAt,
} from '../public-parser-utils';

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

const BLOCK_TAG_PATTERN =
  /<\/?(?:address|article|aside|blockquote|br|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|li|main|nav|ol|p|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

const NEXT_FIELD_LABELS = [
  '信息编号',
  '更新时间',
  '发布时间',
  '发布于',
  '最近更新',
  '区域',
  '所在区域',
  '所在位置',
  '位置',
  '地址',
  '地      址',
  '区县商圈',
  '楼盘地址',
  '面积',
  '建筑面积',
  '厂房面积',
  '仓库面积',
  '总面积',
  '总可租面积',
  '可租面积',
  '起租面积',
  '租金',
  '价格',
  '售价',
  '单价',
  '联系人',
  '联系人姓名',
  '经纪人',
  '电话',
  '联系电话',
  '手机号',
  '手机',
  '联系方式',
  '主营商圈',
  '类型',
  '房源编号',
  '标题',
];

const DISTRICT_NAMES = [
  '莞城',
  '东城',
  '南城',
  '万江',
  '虎门',
  '厚街',
  '樟木头',
  '常平',
  '长安',
  '石碣',
  '石龙',
  '凤岗',
  '黄江',
  '塘厦',
  '清溪',
  '茶山',
  '石排',
  '企石',
  '桥头',
  '谢岗',
  '大朗',
  '寮步',
  '东坑',
  '横沥',
  '大岭山',
  '沙田',
  '高埗',
  '望牛墩',
  '中堂',
  '麻涌',
  '洪梅',
  '道滘',
  '松山湖',
  '滨海湾',
  '顺德',
  '南海',
  '禅城',
  '三水',
  '高明',
  '番禺',
  '南沙',
  '黄埔',
  '花都',
  '白云',
  '增城',
  '从化',
  '天河',
  '海珠',
  '越秀',
  '荔湾',
  '宝安',
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
  '龙岗',
  '龙华',
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
  '福田',
  '南山',
  '罗湖',
  '盐田',
  '坪山',
  '坑梓',
  '马峦',
  '碧岭',
  '石井',
  '龙田',
  '光明',
  '公明',
  '凤凰',
  '玉塘',
  '马田',
  '新湖',
  '大鹏',
  '葵涌',
  '南澳',
  '惠城',
  '惠阳',
  '仲恺',
  '博罗',
  '中山',
  '斗门',
  '金湾',
  '香洲',
  '江海',
  '蓬江',
  '新会',
];

interface StrictListingParserConfig {
  areaLabels?: string[];
  cityLabels?: string[];
  contactLabels?: string[];
  districtLabels?: string[];
  phoneLabels?: string[];
  priceLabels?: string[];
  publishedLabels?: string[];
  sourceSite: string;
  titleSuffixPattern?: RegExp;
}

const DEFAULT_CITY_LABELS = [
  '城市',
  '所在城市',
  '区域',
  '所在区域',
  '所在位置',
  '位置',
  '地址',
  '地      址',
  '区县商圈',
  '楼盘地址',
];

const DEFAULT_DISTRICT_LABELS = [
  '区域',
  '所在区域',
  '所在位置',
  '位置',
  '地址',
  '地      址',
  '区县商圈',
  '楼盘地址',
];

const DEFAULT_AREA_LABELS = [
  '面积',
  '建筑面积',
  '厂房面积',
  '仓库面积',
  '总面积',
  '总可租面积',
  '可租面积',
  '起租面积',
];

const DEFAULT_PRICE_LABELS = ['租金', '价格', '售价', '单价', '月租金', '报价'];

const DEFAULT_CONTACT_LABELS = [
  '联系人',
  '联系人姓名',
  '经纪人',
  '顾问',
  '置业顾问',
  '招商经理',
  '联系人信息',
];

const DEFAULT_PHONE_LABELS = [
  '联系电话',
  '咨询电话',
  '联系电话/手机',
  '联系方式',
  '手机号码',
  '手机号',
  '电话',
  '手机',
];

const DEFAULT_PUBLISHED_LABELS = [
  '发布时间',
  '更新时间',
  '发布于',
  '最近更新',
  '更新于',
  '信息发布',
];

const PHONE_PATTERN =
  /((?:\+?86[-\s]?)?1[3-9]\d(?:[-\s]?\d){8}|(?:0\d{2,3}[-\s]?)?\d{7,8}|400[-\s]?\d{3}[-\s]?\d{4})/;

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

function stripHtmlToLines(html: string) {
  const text = decodeHtmlEntities(
    html
      .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '\n')
      .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '\n')
      .replaceAll(BLOCK_TAG_PATTERN, '\n')
      .replaceAll(/<[^>]*>/g, ' '),
  );

  return text
    .split(/\n+/)
    .map((line) => line.replaceAll(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeLabel(value: string) {
  return value.replaceAll(/[：:\s]/g, '').trim();
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function buildLooseLabelPattern(label: string) {
  return [...normalizeLabel(label)]
    .map((character) => escapeRegExp(character))
    .join(String.raw`\s*`);
}

function trimAtNextField(value: string) {
  const normalized = value.replaceAll(/\s+/g, ' ').trim();
  const indexes = NEXT_FIELD_LABELS.map((label) => {
    const pattern = new RegExp(`\\s${escapeRegExp(label)}\\s*[：:]?`, 'u');
    const match = normalized.match(pattern);
    return match?.index && match.index > 0 ? match.index : -1;
  }).filter((index) => index > 0);
  const firstIndex = indexes.sort((left, right) => left - right)[0];
  return (firstIndex ? normalized.slice(0, firstIndex) : normalized).trim();
}

function cleanFieldValue(value: null | string | undefined) {
  const text = cleanText(decodeHtmlEntities(value || ''))
    .replaceAll(/[【】]/g, '')
    .replaceAll(/\[\s*\]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
  return trimAtNextField(text) || null;
}

function extractInlineValue(line: string, label: string) {
  const labelPattern = buildLooseLabelPattern(label);
  const colonPattern = new RegExp(
    `^\\s*${labelPattern}\\s*[：:]\\s*(.+)$`,
    'u',
  );
  const colonMatch = line.match(colonPattern);
  if (colonMatch?.[1]) {
    return cleanFieldValue(colonMatch[1]);
  }

  const prefixPattern = new RegExp(`^${labelPattern}\\s+(.+)$`, 'u');
  const prefixMatch = line.match(prefixPattern);
  if (prefixMatch?.[1]) {
    return cleanFieldValue(prefixMatch[1]);
  }

  return null;
}

function isExactLabelLine(line: string, labels: string[]) {
  const normalizedLine = normalizeLabel(line);
  return labels.some((label) => normalizedLine === normalizeLabel(label));
}

function findNextValueLine(
  lines: string[],
  startIndex: number,
  labels: string[],
) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || isExactLabelLine(line, labels)) {
      continue;
    }
    return cleanFieldValue(line);
  }
  return null;
}

function extractLabeledValue(lines: string[], labels: string[]) {
  for (const [index, line] of lines.entries()) {
    for (const label of labels) {
      const inlineValue = extractInlineValue(line, label);
      if (inlineValue) {
        return inlineValue;
      }
      if (isExactLabelLine(line, [label])) {
        const nextValue = findNextValueLine(lines, index, labels);
        if (nextValue) {
          return nextValue;
        }
      }
    }
  }

  return null;
}

function extractTitleMeta(html: string) {
  const metaMatches = html.matchAll(/<meta\b[^>]*>/gi);
  for (const [tag] of metaMatches) {
    if (
      !/(?:property|name)\s*=\s*["'](?:og:title|twitter:title)["']/i.test(tag)
    ) {
      continue;
    }
    const content = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
    if (content) {
      return cleanFieldValue(content);
    }
  }

  return null;
}

function extractTitle(html: string, titleSuffixPattern?: RegExp) {
  const title =
    cleanFieldValue(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
    cleanFieldValue(html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1]) ||
    extractTitleMeta(html) ||
    cleanFieldValue(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);

  if (!title) {
    return null;
  }

  return titleSuffixPattern
    ? title.replace(titleSuffixPattern, '').trim() || title
    : title;
}

function normalizeAreaText(value: null | string) {
  if (!value) {
    return null;
  }
  const areaMatch = value.match(
    /\d[\d,.]*(?:\s*[~\-至到]\s*\d[\d,.]*)?\s*(?:万\s*)?(?:平方米|平米|平方|m²|m2|[㎡亩平])/iu,
  );
  return areaMatch?.[0]?.trim() || null;
}

function normalizeNumberText(value: string) {
  const number = Number(value.replaceAll(',', '').trim());
  return Number.isFinite(number) ? number : null;
}

function normalizeAreaSqm(areaText: null | string) {
  if (!areaText || /[~\-至到]/u.test(areaText)) {
    return null;
  }

  const compactAreaText = areaText.replaceAll(/\s+/g, '');
  const match = compactAreaText.match(
    /(\d[\d,.]*)(万)?(平方米|平米|平方|m²|m2|[㎡亩平])/iu,
  );
  if (!match?.[1]) {
    return null;
  }

  const number = normalizeNumberText(match[1]);
  if (!number) {
    return null;
  }

  const multiplier = match[2] ? 10_000 : 1;
  if (match[3] === '亩') {
    return Math.round(number * multiplier * 666.6667 * 100) / 100;
  }
  return number * multiplier;
}

function extractAreaFromText(text: string) {
  return normalizeAreaText(text);
}

function normalizePriceText(value: null | string) {
  if (!value) {
    return null;
  }
  if (/面议|电议|价格可面议|价格面谈/u.test(value)) {
    return value.match(/价格可面议|价格面谈|面议|电议/u)?.[0] || null;
  }
  const priceMatch = value.match(
    /\d[\d,.]*(?:\s*万)?\s*[元块¥￥](?:\s*(?:[/.／·・]\s*)?(?:m²|m2|平方米|平米|平方|[㎡亩平月天日年]))*\s*起?/iu,
  );
  return priceMatch?.[0]?.trim() || null;
}

function extractPriceFromText(text: string) {
  return (
    normalizePriceText(
      text.match(
        /(?:租金|价格|单价|报价|月租|参考价)[：:\s]*[^，,。；;\n]{1,40}/u,
      )?.[0] || null,
    ) || normalizePriceText(text)
  );
}

function normalizePhoneNumber(value: null | string) {
  if (!value) {
    return null;
  }
  const phoneMatch = value.match(PHONE_PATTERN);
  if (!phoneMatch?.[1]) {
    return null;
  }

  const phone = phoneMatch[1].replaceAll(/\s+/g, '');
  const compactMobile = phone.replaceAll('-', '');
  return /^1[3-9]\d{9}$/.test(compactMobile) ? compactMobile : phone;
}

function normalizeContactName(value: null | string) {
  if (!value) {
    return null;
  }
  const contact = value
    .replace(PHONE_PATTERN, ' ')
    .replaceAll(
      /电话联系TA|在线咨询|微信扫码咨询|查看TA的房源|扫一扫，进详情|拨打电话|联系我时请说是在[^，,。]*看到的/g,
      '',
    )
    .replaceAll(/[：:，,;；|｜/\\]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  return contact && contact.length <= 30 ? contact : null;
}

function extractDateText(value: null | string) {
  if (!value) {
    return null;
  }

  return (
    value
      .match(/\d+\s*(?:分钟|小时|[天日周月年])前/u)?.[0]
      ?.replaceAll(/\s+/g, '') ||
    value.match(
      /20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/u,
    )?.[0] ||
    value.match(/\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2})?/u)?.[0] ||
    null
  );
}

function extractPublishedDateText(lines: string[], labels: string[]) {
  for (const [index, line] of lines.entries()) {
    for (const label of labels) {
      const inlineDate = extractDateText(extractInlineValue(line, label));
      if (inlineDate) {
        return inlineDate;
      }
      if (isExactLabelLine(line, [label])) {
        const nextDate = extractDateText(
          findNextValueLine(lines, index, labels),
        );
        if (nextDate) {
          return nextDate;
        }
      }
    }
  }

  return null;
}

function extractPhoneFromHtml(html: string) {
  const decodedHtml = decodeHtmlEntities(html);
  const telMatch = html.match(/href\s*=\s*["']tel:([^"']+)["']/i)?.[1];
  const explicitPhoneMatch = decodedHtml.match(
    /(?:telephone|phoneNumber|phone|mobile|data-phone|data-mobile|联系电话|咨询电话)["'\s:=：]+([^"',，\s<]+)/i,
  )?.[1];
  return (
    normalizePhoneNumber(telMatch) || normalizePhoneNumber(explicitPhoneMatch)
  );
}

function extractCity(lines: string[], labels: string[]) {
  for (const label of labels) {
    const value = extractLabeledValue(lines, [label]);
    const city = normalizeGuangdongCity(value);
    if (city) {
      return city;
    }
  }

  return null;
}

function extractCityFromText(text: string) {
  const city = normalizeGuangdongCity(text);
  if (city) {
    return city;
  }

  return null;
}

function stripCityFromDistrict(value: string) {
  let result = value;
  for (const city of GUANGDONG_CITY_NAMES) {
    result = result.replaceAll(`${city}市`, '').replaceAll(city, '');
  }
  return result;
}

function normalizeDistrict(value: null | string) {
  if (!value) {
    return null;
  }

  const withoutCity = stripCityFromDistrict(value)
    .replaceAll('广东省', '')
    .replaceAll('广东', '')
    .replaceAll(/地图|楼盘|地址/g, ' ')
    .replaceAll(/[()（）]/g, ' ')
    .trim();
  const segments = withoutCity
    .split(/[-—–,，、/|｜\s]+/u)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const matchedKnownDistrict = segments.find((segment) =>
    DISTRICT_NAMES.some(
      (district) => segment === district || segment.startsWith(district),
    ),
  );
  if (matchedKnownDistrict) {
    const district = DISTRICT_NAMES.find((item) =>
      matchedKnownDistrict.startsWith(item),
    );
    return district || matchedKnownDistrict;
  }

  return (
    withoutCity.match(
      /([\u4E00-\u9FA5]{2,10}(?:区|镇|街道|工业区|开发区|新区|园区))/u,
    )?.[1] || null
  );
}

function extractDistrict(lines: string[], labels: string[]) {
  for (const label of labels) {
    const district = normalizeDistrict(extractLabeledValue(lines, [label]));
    if (district) {
      return district;
    }
  }

  return null;
}

function extractDistrictFromText(text: string) {
  return normalizeDistrict(text);
}

function mergeLabels(
  defaultLabels: string[],
  overrideLabels: string[] | undefined,
) {
  return [...new Set([...(overrideLabels || []), ...defaultLabels])];
}

export function extractStrictListingFromHtml(
  html: string,
  sourceUrl: string,
  config: StrictListingParserConfig,
): ParsedPublicOpportunity {
  const lines = stripHtmlToLines(html);
  const text = cleanText(html);
  const publishedLabels = mergeLabels(
    DEFAULT_PUBLISHED_LABELS,
    config.publishedLabels,
  );
  const publishedDateText = extractPublishedDateText(lines, publishedLabels);
  const title = extractTitle(html, config.titleSuffixPattern);
  const titleText = title || '';
  const searchableText = [title, text].filter(Boolean).join(' ');
  const areaText =
    normalizeAreaText(
      extractLabeledValue(
        lines,
        mergeLabels(DEFAULT_AREA_LABELS, config.areaLabels),
      ),
    ) || extractAreaFromText(searchableText);
  const phoneNumber =
    normalizePhoneNumber(
      extractLabeledValue(
        lines,
        mergeLabels(DEFAULT_PHONE_LABELS, config.phoneLabels),
      ),
    ) || extractPhoneFromHtml(html);
  const result = {
    areaSqm: normalizeAreaSqm(areaText),
    areaText,
    city:
      extractCity(lines, mergeLabels(DEFAULT_CITY_LABELS, config.cityLabels)) ||
      extractCityFromText(titleText),
    contactName: normalizeContactName(
      extractLabeledValue(
        lines,
        mergeLabels(DEFAULT_CONTACT_LABELS, config.contactLabels),
      ),
    ),
    description: text.slice(0, 2000) || null,
    district:
      extractDistrict(
        lines,
        mergeLabels(DEFAULT_DISTRICT_LABELS, config.districtLabels),
      ) || extractDistrictFromText(titleText),
    industryText: null,
    opportunityType: 'SUPPLY' as const,
    phoneNumber,
    priceText:
      normalizePriceText(
        extractLabeledValue(
          lines,
          mergeLabels(DEFAULT_PRICE_LABELS, config.priceLabels),
        ),
      ) || extractPriceFromText(searchableText),
    publishedAt: normalizePublishedAt(publishedDateText),
    publishedDateText,
    sourceSite: config.sourceSite,
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

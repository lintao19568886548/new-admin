import type { ParsedPublicOpportunity } from '../types';

import {
  buildDetailJson,
  cleanText,
  collectMissingFields,
  extractAreaText,
  extractContactName,
  extractDistrict,
  extractFirstMatch,
  extractIndustryText,
  extractPriceText,
  extractPublishedDateText,
  extractTitle,
  normalizePublishedAt,
} from '../public-parser-utils';

interface BuildPublicDemandOpportunityOptions {
  html: string;
  sourceSite: string;
  sourceUrl: string;
}

const GUANGDONG_CITY_ALIASES = [
  ['广州', ['广州', '广州市', 'guangzhou', 'gz']],
  ['深圳', ['深圳', '深圳市', 'shenzhen', 'sz']],
  ['珠海', ['珠海', '珠海市', 'zhuhai', 'zh']],
  ['汕头', ['汕头', '汕头市', 'shantou', 'st']],
  ['佛山', ['佛山', '佛山市', 'foshan', 'fs']],
  ['韶关', ['韶关', '韶关市', 'shaoguan', 'sg']],
  ['湛江', ['湛江', '湛江市', 'zhanjiang', 'zj']],
  ['肇庆', ['肇庆', '肇庆市', 'zhaoqing', 'zq']],
  ['江门', ['江门', '江门市', 'jiangmen', 'jm']],
  ['茂名', ['茂名', '茂名市', 'maoming', 'mm']],
  ['惠州', ['惠州', '惠州市', 'huizhou', 'hz']],
  ['梅州', ['梅州', '梅州市', 'meizhou', 'mz']],
  ['汕尾', ['汕尾', '汕尾市', 'shanwei', 'sw']],
  ['河源', ['河源', '河源市', 'heyuan', 'hy']],
  ['阳江', ['阳江', '阳江市', 'yangjiang', 'yj']],
  ['清远', ['清远', '清远市', 'qingyuan', 'qy']],
  ['东莞', ['东莞', '东莞市', 'dongguan', 'dg']],
  ['中山', ['中山', '中山市', 'zhongshan', 'zs']],
  ['潮州', ['潮州', '潮州市', 'chaozhou', 'cz']],
  ['揭阳', ['揭阳', '揭阳市', 'jieyang', 'jy']],
  ['云浮', ['云浮', '云浮市', 'yunfu', 'yf']],
] as const;

const DEMAND_CITY_LABELS = [
  '需求城市',
  '需求区域',
  '意向城市',
  '意向区域',
  '所在城市',
  '求租城市',
  '求租区域',
  '城市',
  '地区',
  '区域',
  '地址',
  '位置',
  '所在地',
  '所在区域',
  '选址区域',
  '招商区域',
  '项目区域',
  '落地区域',
];

const DEMAND_AREA_LABELS = [
  '厂房面积',
  '仓库面积',
  '需求面积',
  '需求体量',
  '面积范围',
  '意向面积',
  '求租面积',
  '求购面积',
  '租赁面积',
  '计划面积',
  '用房面积',
  '建筑面积',
  '面积需求',
  '面积',
];

const DEMAND_BUDGET_LABELS = [
  '价格',
  '预算',
  '租金预算',
  '预算价格',
  '价格预算',
  '期望价格',
  '期望租金',
  '可承受租金',
  '承受租金',
  '投资预算',
  '总价预算',
  '租金范围',
  '价格范围',
  '单价预算',
  '月租金',
  '租金',
];

const DEMAND_INDUSTRY_LABELS = [
  '行业',
  '行业类型',
  '需求行业',
  '企业行业',
  '项目行业',
  '所属行业',
  '所属产业',
  '经营行业',
  '产业类型',
  '项目类型',
  '用房类型',
];

const DEMAND_CONTACT_LABELS = [
  '称呼',
  '联系人',
  '联 系 人',
  '联系 人',
  '联系人姓名',
  '联络人',
  '姓名',
  '负责人',
  '对接人',
  '发布人',
];

const DEMAND_PHONE_LABELS = [
  '联系电话',
  '联系手机',
  '联络电话',
  '电话',
  '手机',
  '手机号码',
  '联系方式',
  '联系电话号码',
];

const DEMAND_PUBLISHED_LABELS = [
  '发布时间',
  '发布日期',
  '更新时间',
  '更新日期',
  '最近更新',
  '信息发布',
  '发布于',
  '发布',
];

const LEGACY_FIELD_LABELS = [
  '需求城市',
  '需求区域',
  '意向城市',
  '所在城市',
  '求租城市',
  '求租区域',
  '城市',
  '地区',
  '区域',
  '所在地',
  '所在区域',
  '厂房面积',
  '仓库面积',
  '需求面积',
  '需求体量',
  '求租面积',
  '求购面积',
  '面积需求',
  '面积',
  '价格',
  '预算',
  '租金预算',
  '价格预算',
  '期望价格',
  '投资预算',
  '总价预算',
  '可承受租金',
  '期望租金',
  '行业',
  '行业类型',
  '企业行业',
  '项目行业',
  '所属行业',
  '经营行业',
  '产业类型',
  '称呼',
  '联系人',
  '联系 人',
  '联系人姓名',
  '负责人',
  '对接人',
  '联系电话',
  '联系手机',
  '电话',
  '手机',
  '手机号码',
  '联系方式',
  '发布时间',
  '发布日期',
  '更新时间',
  '信息发布',
  '发布人',
];

const FIELD_LABELS = [
  ...new Set([
    ...DEMAND_AREA_LABELS,
    ...DEMAND_BUDGET_LABELS,
    ...DEMAND_CITY_LABELS,
    ...DEMAND_CONTACT_LABELS,
    ...DEMAND_INDUSTRY_LABELS,
    ...DEMAND_PHONE_LABELS,
    ...DEMAND_PUBLISHED_LABELS,
    ...LEGACY_FIELD_LABELS,
  ]),
];

const FIELD_LABEL_PATTERN = FIELD_LABELS.map((label) =>
  escapeRegExp(label),
).join('|');

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll(/&nbsp;/gi, ' ')
    .replaceAll(/&amp;/gi, '&')
    .replaceAll(/&lt;/gi, '<')
    .replaceAll(/&gt;/gi, '>')
    .replaceAll(/&quot;/gi, '"')
    .replaceAll('&#39;', "'")
    .replaceAll(/&#x([0-9a-f]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    );
}

function htmlToReadableLines(html: string) {
  return decodeHtmlEntities(String(html || ''))
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<br\s*\/?>/gi, '\n')
    .replaceAll(/<\/(?:div|p|li|tr|dd|dt|h[1-6]|section|article)>/gi, '\n')
    .replaceAll(/<\/(?:td|th)>/gi, '\t')
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/[ \f\r\v]+/g, ' ')
    .replaceAll(/\t+/g, '\t')
    .replaceAll(/\s*\n\s*/g, '\n')
    .replaceAll(/\n{2,}/g, '\n')
    .trim();
}

function normalizeFieldValue(value: string) {
  return value
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/^[-\s:：;；,，]+/g, '')
    .replaceAll(/[\s,，。；;]+$/g, '')
    .trim();
}

function trimAtNextLabel(value: string) {
  const match = value.match(
    new RegExp(
      `(?:\\s|[，,。；;])(?:${FIELD_LABEL_PATTERN})\\s*[:：]?|(?:${FIELD_LABEL_PATTERN})\\s*[:：]`,
    ),
  );
  return normalizeFieldValue(
    match?.index === undefined ? value : value.slice(0, match.index),
  );
}

function isLabelOnlyValue(value: string, labels: string[]) {
  return labels.some(
    (label) =>
      value === label || value === `${label}:` || value === `${label}：`,
  );
}

function extractLabeledValue(linesText: string, labels: string[]) {
  const sortedLabels = [...labels].sort(
    (left, right) => right.length - left.length,
  );
  const lines = linesText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const [index, line] of lines.entries()) {
    const cells = line
      .split('\t')
      .map((cell) => normalizeFieldValue(cell))
      .filter(Boolean);

    for (const [cellIndex, cell] of cells.entries()) {
      if (isLabelOnlyValue(cell, sortedLabels)) {
        const nextCell = cells[cellIndex + 1];
        if (nextCell) {
          return trimAtNextLabel(nextCell);
        }
      }
    }

    const compactLine = normalizeFieldValue(line.replaceAll('\t', ' '));
    for (const label of sortedLabels) {
      if (isLabelOnlyValue(compactLine, [label])) {
        const nextLine = lines[index + 1]
          ? trimAtNextLabel(lines[index + 1].replaceAll('\t', ' '))
          : null;
        if (nextLine) {
          return nextLine;
        }
      }

      const match = compactLine.match(
        new RegExp(`(?:^|\\s)${escapeRegExp(label)}\\s*[:：]\\s*(.+)$`),
      );
      const value = match?.[1] ? trimAtNextLabel(match[1]) : null;
      if (value) {
        return value;
      }

      const whitespaceMatch = compactLine.match(
        new RegExp(`(?:^|\\s)${escapeRegExp(label)}\\s+(.+)$`),
      );
      const whitespaceValue = whitespaceMatch?.[1]
        ? trimAtNextLabel(whitespaceMatch[1])
        : null;
      if (whitespaceValue) {
        return whitespaceValue;
      }
    }
  }

  return null;
}

function extractMetaContent(html: string, names: string[]) {
  for (const name of names) {
    const escapedName = escapeRegExp(name);
    const value = extractFirstMatch(html, [
      new RegExp(
        `<meta[^>]+(?:name|property)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escapedName}["'][^>]*>`,
        'i',
      ),
    ]);
    if (value) {
      return cleanText(decodeHtmlEntities(value));
    }
  }
  return null;
}

function parseJsonLikeBlocks(html: string) {
  const records: Record<string, unknown>[] = [];
  const pattern =
    /<script(?:\s[^>]*)?type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = decodeHtmlEntities(match[1] || '').trim();
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item || typeof item !== 'object') {
          continue;
        }
        if (Array.isArray(item)) {
          queue.push(...item);
        } else {
          const record = item as Record<string, unknown>;
          records.push(record);
          for (const value of Object.values(record)) {
            if (value && typeof value === 'object') {
              queue.push(value);
            }
          }
        }
      }
    } catch {
      // Ignore broken inline JSON; visible text parsing still applies.
    }
  }
  return records;
}

function extractJsonField(
  records: Record<string, unknown>[],
  fieldNames: string[],
) {
  for (const record of records) {
    for (const fieldName of fieldNames) {
      const value = record[fieldName];
      if (typeof value === 'string' && value.trim()) {
        return cleanText(value);
      }
    }
  }
  return null;
}

function extractDemandGuangdongCity(
  value: null | string | undefined,
  options: { allowShortCodes?: boolean } = {},
) {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const [city, aliases] of GUANGDONG_CITY_ALIASES) {
    for (const alias of aliases) {
      const normalizedAlias = alias.toLowerCase();
      if (!options.allowShortCodes && /^[a-z]{2}$/.test(normalizedAlias)) {
        continue;
      }
      if (normalized.includes(normalizedAlias)) {
        return city;
      }
    }
  }

  return null;
}

function extractDemandCityFromUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const tokens = [
      ...url.hostname.toLowerCase().split('.'),
      ...url.pathname.toLowerCase().split(/[^a-z0-9]+/),
    ].filter(Boolean);
    for (const token of tokens) {
      for (const [city, aliases] of GUANGDONG_CITY_ALIASES) {
        if (
          aliases.some((alias) => {
            const normalizedAlias = alias.toLowerCase();
            return (
              token === normalizedAlias ||
              (/^[a-z]{2}$/.test(normalizedAlias) &&
                token.endsWith(normalizedAlias) &&
                token.length <= 8)
            );
          })
        ) {
          return city;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

function extractDemandCity(linesText: string, text: string, sourceUrl: string) {
  const labeledValue = extractLabeledValue(linesText, [
    ...DEMAND_CITY_LABELS,
    ...LEGACY_FIELD_LABELS,
  ]);
  return (
    extractDemandGuangdongCity(labeledValue) ||
    extractDemandGuangdongCity(text) ||
    extractDemandCityFromUrl(sourceUrl)
  );
}

function extractDemandDistrict(linesText: string, text: string) {
  const labeledValue = extractLabeledValue(linesText, DEMAND_CITY_LABELS);
  const cityPattern = GUANGDONG_CITY_ALIASES.map(([city]) =>
    escapeRegExp(city),
  ).join('|');
  const districtPatterns = [
    new RegExp(
      `((?:${cityPattern})(?:市)?[\\u4E00-\\u9FA5]{1,12}(?:区|县|镇|街道|开发区|高新区|新区|产业园))`,
    ),
    /([\u4E00-\u9FA5]{2,12}(?:[区县镇]|街道|开发区|高新区|新区|产业园))/,
  ];

  if (labeledValue) {
    return extractFirstMatch(labeledValue, districtPatterns);
  }

  return extractFirstMatch(text, districtPatterns) || extractDistrict(text);
}

function extractDemandArea(linesText: string, text: string) {
  const labeledValue = extractLabeledValue(linesText, DEMAND_AREA_LABELS);
  const scope = labeledValue || text;
  return (
    extractFirstMatch(scope, [
      /(\d[0-9.,]*(?:\s*[-~至到—–]\s*\d[0-9.,]*)?\s*(?:万\s*)?(?:平方米|平米|平方|[㎡方亩]|m²|m2))/i,
    ]) || extractAreaText(text)
  );
}

function extractDemandBudget(linesText: string, text: string) {
  const labeledValue = extractLabeledValue(linesText, DEMAND_BUDGET_LABELS);
  const scope = labeledValue || text;
  return (
    extractFirstMatch(scope, [
      /((?:¥|￥)?\s*\d[0-9.,]*(?:\s*[-~至到—–]\s*\d[0-9.,]*)?\s*(?:万元|亿元|[元万亿块])(?:\s*(?:\/\s*)?(?:[㎡月天平]|m2|平方米|平米))?[^\s,，。；;]*)/,
      /(面议|不限|可谈|价格可议)/,
    ]) || extractPriceText(text)
  );
}

function normalizeIndustryValue(value: null | string | undefined) {
  const normalized = trimAtNextLabel(String(value || ''));
  return normalized
    ? normalized
        .replaceAll(/^(行业|行业类型|所属行业|产业类型)[:：\s]*/g, '')
        .split(/[，,。；;\s]/)[0]
        ?.trim() || null
    : null;
}

function extractDemandIndustry(linesText: string, text: string) {
  return (
    normalizeIndustryValue(
      extractLabeledValue(linesText, DEMAND_INDUSTRY_LABELS),
    ) ||
    extractFirstMatch(text, [
      /(?:行业|行业类型|所属行业|产业类型|项目行业)[:：\s]*([\u4E00-\u9FA5A-Z0-9、/-]{2,40})/i,
    ]) ||
    extractIndustryText(text)
  );
}

function normalizeContactName(value: null | string | undefined) {
  let normalized = normalizeFieldValue(String(value || '')).replace(
    /^(?:联系人|联 系 人|联系 人|联系人姓名|联络人|姓名|联系方式|称呼|负责人|对接人|发布人)[:：\s]*/,
    '',
  );
  for (const label of [...DEMAND_PHONE_LABELS, ...DEMAND_PUBLISHED_LABELS].sort(
    (left, right) => right.length - left.length,
  )) {
    const labelIndex = normalized.indexOf(label);
    if (labelIndex > 0) {
      normalized = normalized.slice(0, labelIndex);
    }
  }
  normalized = normalizeFieldValue(normalized);
  if (!normalized || /^(?:电话|手机|联系|方式|联系方式)$/.test(normalized)) {
    return null;
  }
  return (
    extractFirstMatch(normalized, [
      /([\u4E00-\u9FA5]{1,4}(?:先生|女士|经理|总|老板|负责人))/,
      /([\u4E00-\u9FA5]{2,4})/,
    ]) || null
  );
}

function extractDemandContactName(linesText: string, text: string) {
  return (
    normalizeContactName(
      extractLabeledValue(linesText, DEMAND_CONTACT_LABELS),
    ) ||
    normalizeContactName(
      extractFirstMatch(text, [
        /(?:联系人|联 系 人|联系 人|联系人姓名|联络人|姓名|联系方式|称呼|负责人|对接人|发布人)[:：\s]*([\u4E00-\u9FA5]{1,4}(?:先生|女士|经理|总|老板|负责人))/,
        /(?:联系人|联 系 人|联系 人|联系人姓名|联络人|姓名|联系方式|称呼|负责人|对接人|发布人)[:：\s]*([\u4E00-\u9FA5]{2,4})/,
      ]),
    ) ||
    extractContactName(text)
  );
}

function normalizeMobilePhoneValue(value: string) {
  const phone = extractFirstMatch(value, [
    /((?:\+?86[-\s]?)?1[3-9](?:[-\s]?\d){9})/,
    /(400[-\s]?\d{3}[-\s]?\d{4})/,
  ]);
  return phone ? phone.replaceAll(/[^\d+]/g, '').replace(/^\+?86/, '') : null;
}

function normalizePhoneValue(value: string) {
  const phone = extractFirstMatch(value, [
    /((?:\+?86[-\s]?)?1[3-9](?:[-\s]?\d){9})/,
    /((?:0\d{2,3}[-\s]?)?\d{7,8})/,
    /(400[-\s]?\d{3}[-\s]?\d{4})/,
  ]);
  return phone ? phone.replaceAll(/[^\d+]/g, '').replace(/^\+?86/, '') : null;
}

function extractDemandPhoneNumber(linesText: string, text: string) {
  const labeledValue = extractLabeledValue(linesText, DEMAND_PHONE_LABELS);
  const inlineLabeledValue = extractFirstMatch(text, [
    /(?:联系电话|联系手机|联络电话|电话|手机|手机号码|联系方式|联系电话号码)[:：\s]*((?:\+?86[-\s]?)?1[3-9](?:[-\s]?\d){9}|(?:0\d{2,3}[-\s]?)?\d{7,8}|400[-\s]?\d{3}[-\s]?\d{4})/,
  ]);
  return (
    (labeledValue ? normalizePhoneValue(labeledValue) : null) ||
    (inlineLabeledValue ? normalizePhoneValue(inlineLabeledValue) : null) ||
    normalizeMobilePhoneValue(text)
  );
}

function extractDemandPublishedDateText(linesText: string, text: string) {
  const labeledValue = extractLabeledValue(linesText, DEMAND_PUBLISHED_LABELS);
  const scope = labeledValue || text;
  return (
    extractPublishedDateText(scope) ||
    extractFirstMatch(scope, [
      /(刚刚|刚发布|\d+\s*(?:分钟|小时|[天日周月年])前)/,
      /((?:今天|昨日|昨天)\s*\d{1,2}:\d{2}(?::\d{2})?)/,
      /(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/,
      /(20\d{2}[01]\d[0-3]\d)/,
    ]) ||
    null
  );
}

function normalizeDemandPublishedAt(publishedDateText: null | string) {
  const parsed = normalizePublishedAt(publishedDateText);
  if (parsed) {
    return parsed;
  }

  const text = String(publishedDateText || '').trim();
  if (!text) {
    return null;
  }
  if (/刚刚|刚发布/.test(text)) {
    return new Date().toISOString();
  }

  const compactDateMatch = /^(20\d{2})([01]\d)([0-3]\d)$/.exec(text);
  if (compactDateMatch) {
    const date = new Date(
      Number(compactDateMatch[1]),
      Number(compactDateMatch[2]) - 1,
      Number(compactDateMatch[3]),
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const minuteMatch = /(\d+)\s*分钟前/.exec(text);
  if (minuteMatch?.[1]) {
    return new Date(
      Date.now() - Number(minuteMatch[1]) * 60 * 1000,
    ).toISOString();
  }
  const hourMatch = /(\d+)\s*小时前/.exec(text);
  if (hourMatch?.[1]) {
    return new Date(
      Date.now() - Number(hourMatch[1]) * 60 * 60 * 1000,
    ).toISOString();
  }
  const dayRelativeMatch =
    /^(今天|昨日|昨天)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (dayRelativeMatch) {
    const dayOffset = dayRelativeMatch[1] === '今天' ? 0 : 1;
    const base = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
    const shanghaiDate = new Date(base.getTime() + 8 * 60 * 60 * 1000);
    const date = new Date(
      `${shanghaiDate.getUTCFullYear()}-${String(
        shanghaiDate.getUTCMonth() + 1,
      ).padStart(2, '0')}-${String(shanghaiDate.getUTCDate()).padStart(
        2,
        '0',
      )}T${dayRelativeMatch[2].padStart(2, '0')}:${
        dayRelativeMatch[3]
      }:${(dayRelativeMatch[4] || '0').padStart(2, '0')}+08:00`,
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function extractVisibleTitle(html: string) {
  const title = extractFirstMatch(html, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<h2[^>]*>([\s\S]*?)<\/h2>/i,
    /<h3[^>]*>([\s\S]*?)<\/h3>/i,
    /<[^>]+class=["'][^"']*(?:title|tit|bt)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ]);
  return title
    ? cleanText(decodeHtmlEntities(title))
        .replace(/\s*[-_|]\s*(?:99厂房网|厂房在线|中工招商网).*$/, '')
        .trim()
    : null;
}

function extractDemandTitle(
  html: string,
  jsonRecords: Record<string, unknown>[],
) {
  return (
    extractVisibleTitle(html) ||
    extractTitle(html) ||
    extractMetaContent(html, ['og:title', 'twitter:title']) ||
    extractJsonField(jsonRecords, ['title', 'name', 'headline'])
  );
}

function extractDemandDescription(
  html: string,
  text: string,
  jsonRecords: Record<string, unknown>[],
) {
  return (
    extractMetaContent(html, ['description', 'og:description']) ||
    extractJsonField(jsonRecords, ['description', 'articleBody']) ||
    text.slice(0, 2000) ||
    null
  );
}

function buildDemandText(params: {
  description: null | string;
  jsonRecords: Record<string, unknown>[];
  linesText: string;
  text: string;
  title: null | string;
}) {
  return [
    params.title,
    params.description,
    params.text,
    params.linesText,
    extractJsonField(params.jsonRecords, ['description', 'articleBody']),
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildPublicDemandOpportunity({
  html,
  sourceSite,
  sourceUrl,
}: BuildPublicDemandOpportunityOptions): ParsedPublicOpportunity {
  const linesText = htmlToReadableLines(html);
  const text = cleanText(decodeHtmlEntities(html));
  const jsonRecords = parseJsonLikeBlocks(html);
  const title = extractDemandTitle(html, jsonRecords);
  const description = extractDemandDescription(html, text, jsonRecords);
  const demandText = buildDemandText({
    description,
    jsonRecords,
    linesText,
    text,
    title,
  });
  const publishedDateText =
    extractDemandPublishedDateText(linesText, demandText) ||
    extractJsonField(jsonRecords, ['datePublished', 'dateModified']);
  const result = {
    areaText: extractDemandArea(linesText, demandText),
    city: extractDemandCity(linesText, demandText, sourceUrl),
    contactName: extractDemandContactName(linesText, demandText),
    description,
    detailJson: null,
    district: extractDemandDistrict(linesText, demandText),
    industryText: extractDemandIndustry(linesText, demandText),
    missingFields: [],
    opportunityType: 'DEMAND' as const,
    phoneNumber: extractDemandPhoneNumber(linesText, demandText),
    priceText: extractDemandBudget(linesText, demandText),
    publishedAt: normalizeDemandPublishedAt(publishedDateText),
    publishedDateText,
    sourceSite,
    sourceUrl,
    title,
  };
  const missingFields = collectMissingFields(result, [
    'title',
    'city',
    'areaText',
    'sourceUrl',
    'publishedDateText',
  ]);

  return {
    ...result,
    detailJson: buildDetailJson(html, missingFields, publishedDateText),
    missingFields,
  };
}

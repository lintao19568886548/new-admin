import type { ExternalLeadCrawlerUpsertInput } from './external-lead-repository';

type DemandType =
  | 'EXPAND'
  | 'NEW_LINE'
  | 'RELOCATION'
  | 'RENT_FACTORY'
  | 'UNKNOWN';

export type PublicOpportunityLeadSkipReason =
  | 'EXCLUDED_KEYWORD'
  | 'LOW_CONFIDENCE'
  | 'MISSING_SOURCE_URL'
  | 'NO_INCLUDE_KEYWORD'
  | 'NO_RELIABLE_COMPANY_NAME'
  | 'NOT_DEMAND';

export interface PublicOpportunityRow {
  areaSqm?: null | number | string;
  areaText?: null | string;
  city?: null | string;
  contactName?: null | string;
  description?: null | string;
  detailJson?: unknown;
  district?: null | string;
  industryText?: null | string;
  lastSyncedAt?: null | string;
  opportunityId: number;
  opportunityType: string;
  phoneNumber?: null | string;
  priceText?: null | string;
  publishedAt?: null | string;
  sourceSite?: null | string;
  sourceTable?: null | string;
  sourceUrl?: null | string;
  tagsJson?: unknown;
  title?: null | string;
}

const includeKeywords = [
  '扩产',
  '搬迁',
  '迁建',
  '新建厂房',
  '技改',
  '生产线',
  '仓储',
  '求租',
  '租厂房',
  '厂房需求',
  '产业园',
  '项目落地',
  '招商引资',
];

const excludeKeywords = [
  '住宅',
  '商铺',
  '个人',
  '培训',
  '会议',
  '活动宣传',
  '招聘普通岗位',
];

const companyNameLabelPatterns = [
  /(?:公司名称|公司名|企业名称|企业名|单位名称|主体名称|需求企业|需求方|意向企业|入驻企业|项目单位|建设单位|承租企业|承租方|求租企业|求租方|客户名称|联系人单位)[：:\s]*([\u4E00-\u9FA5A-Z0-9（）()]{2,80}(?:股份有限公司|有限责任公司|有限公司|集团有限公司|集团|工厂|厂))/gi,
];

const unreliableCompanyNameFragments = [
  '求租',
  '求购',
  '求组',
  '附近',
  '周边',
  '标准',
  '单一层',
  '平方',
  '平米',
  '需要',
  '寻找',
  '厂房',
  '库房',
  '仓库',
  '办公楼',
  '园区',
  '产业园',
  '场地',
  '房东',
  '个人',
  '培训机构',
];

function parseJsonValue(value: unknown) {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(String(value)) as unknown;
  } catch {
    return null;
  }
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function stringifyJsonValue(value: unknown) {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, (_key, item) =>
      typeof item === 'bigint' ? item.toString() : item,
    );
  } catch {
    return String(value);
  }
}

function buildSearchText(row: PublicOpportunityRow) {
  return [
    row.title,
    row.description,
    row.industryText,
    stringifyJsonValue(row.tagsJson),
    stringifyJsonValue(row.detailJson),
  ]
    .filter(Boolean)
    .join(' ');
}

function normalizeOpportunityType(value: unknown) {
  return normalizeString(value).toUpperCase();
}

function hitKeywords(text: string, keywords: string[]) {
  return keywords.filter((keyword) => text.includes(keyword));
}

function getDetailStringField(detail: unknown, keys: string[]) {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) {
    return null;
  }
  const record = detail as Record<string, unknown>;
  for (const key of keys) {
    const value = normalizeString(record[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function getNestedDetailStringField(detail: unknown, paths: string[][]) {
  for (const path of paths) {
    let current = detail;
    for (const key of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        current = null;
        break;
      }
      current = (current as Record<string, unknown>)[key];
    }
    const value = normalizeString(current);
    if (value) {
      return value;
    }
  }
  return null;
}

function normalizeCompanyName(value: string) {
  return normalizeString(value)
    .replace(/^[：:\s,，、;；]+/, '')
    .replace(/[，,。；;：:\s]+$/, '');
}

function isReliableCompanyName(value: string) {
  const name = normalizeCompanyName(value);
  if (name.length < 4 || name.length > 80) {
    return false;
  }
  if (/[?？!！]/.test(name)) {
    return false;
  }
  if (
    unreliableCompanyNameFragments.some((fragment) => name.includes(fragment))
  ) {
    return false;
  }
  if (!/公司|集团|工厂|厂$/.test(name)) {
    return false;
  }
  if (
    /求租|租赁|出租|厂房|仓库|仓储|生产线|产业园|项目|招商|扩产|搬迁|迁建/.test(
      name,
    ) &&
    !/(?:有限公司|有限责任公司|股份有限公司|集团有限公司|集团)$/.test(name)
  ) {
    return false;
  }
  return true;
}

function extractCompanyName(row: PublicOpportunityRow) {
  const detail = parseJsonValue(row.detailJson);
  const directName = getDetailStringField(detail, [
    'companyName',
    'enterpriseName',
    'tenantName',
    'customerName',
    'orgName',
    'company_name',
    'enterprise_name',
    'tenant_name',
    'customer_name',
    'org_name',
    '单位名称',
    '企业名称',
    '企业名',
    '公司名称',
    '公司名',
    '需求企业',
    '需求方',
    '意向企业',
    '入驻企业',
    '项目单位',
    '建设单位',
    '承租企业',
    '承租方',
    '求租企业',
    '求租方',
    '联系人单位',
  ]);
  if (directName && isReliableCompanyName(directName)) {
    return normalizeCompanyName(directName);
  }

  const nestedName = getNestedDetailStringField(detail, [
    ['company', 'name'],
    ['enterprise', 'name'],
    ['tenant', 'name'],
    ['customer', 'name'],
    ['demand', 'companyName'],
    ['demand', 'enterpriseName'],
    ['project', 'companyName'],
    ['project', 'enterpriseName'],
  ]);
  if (nestedName && isReliableCompanyName(nestedName)) {
    return normalizeCompanyName(nestedName);
  }

  const structuredText = [row.description, stringifyJsonValue(detail)]
    .filter(Boolean)
    .join(' ');
  for (const pattern of companyNameLabelPatterns) {
    for (const match of structuredText.matchAll(pattern)) {
      const companyName = normalizeCompanyName(match[1] || '');
      if (isReliableCompanyName(companyName)) {
        return companyName;
      }
    }
  }
  return null;
}

function resolveDemandType(hitKeywords: string[]): DemandType {
  if (
    hitKeywords.some((keyword) =>
      ['仓储', '厂房需求', '求租', '租厂房'].includes(keyword),
    )
  ) {
    return 'RENT_FACTORY';
  }
  if (hitKeywords.some((keyword) => ['搬迁', '迁建'].includes(keyword))) {
    return 'RELOCATION';
  }
  if (hitKeywords.some((keyword) => ['扩产', '技改'].includes(keyword))) {
    return 'EXPAND';
  }
  if (hitKeywords.includes('生产线')) {
    return 'NEW_LINE';
  }
  return 'UNKNOWN';
}

function calculateConfidenceScore(params: {
  companyName: string;
  hitKeywords: string[];
  row: PublicOpportunityRow;
}) {
  let score = 35;
  score += Math.min(params.hitKeywords.length * 8, 25);
  if (params.row.city) {
    score += 5;
  }
  if (params.row.district) {
    score += 3;
  }
  if (params.row.areaText || params.row.areaSqm) {
    score += 5;
  }
  if (params.row.industryText) {
    score += 5;
  }
  if (params.row.contactName || params.row.phoneNumber) {
    score += 5;
  }
  if (params.companyName) {
    score += 10;
  }
  return Math.max(0, Math.min(95, score));
}

function resolveConfidenceLevel(score: number) {
  if (score >= 80) {
    return 'HIGH' as const;
  }
  if (score >= 60) {
    return 'MEDIUM' as const;
  }
  return 'LOW' as const;
}

function buildSummary(row: PublicOpportunityRow) {
  const parts = [
    row.description,
    row.areaText ? `面积：${row.areaText}` : '',
    row.industryText ? `行业：${row.industryText}` : '',
    row.contactName ? `联系人：${row.contactName}` : '',
    row.phoneNumber ? `电话：${row.phoneNumber}` : '',
  ].filter(Boolean);
  return parts.join('\n') || row.title || '';
}

function buildEvidenceText(row: PublicOpportunityRow) {
  return [
    row.title ? `标题：${row.title}` : '',
    row.description ? `描述：${row.description}` : '',
    row.areaText ? `面积：${row.areaText}` : '',
    row.industryText ? `行业：${row.industryText}` : '',
    row.city || row.district
      ? `区域：${[row.city, row.district].filter(Boolean).join(' / ')}`
      : '',
    row.tagsJson ? `标签：${stringifyJsonValue(row.tagsJson)}` : '',
    row.detailJson ? `详情：${stringifyJsonValue(row.detailJson)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildExternalLeadInputFromPublicOpportunityRow(
  row: PublicOpportunityRow,
  options: {
    crawledAt?: null | string;
    rawEvidenceSuffix?: string;
    sourceName?: string;
    sourceType?: string;
  } = {},
):
  | {
      input: ExternalLeadCrawlerUpsertInput;
      matchedKeywords: string[];
      skipReason?: never;
    }
  | {
      input?: never;
      matchedKeywords?: never;
      skipReason: PublicOpportunityLeadSkipReason;
    } {
  if (normalizeOpportunityType(row.opportunityType) !== 'DEMAND') {
    return { skipReason: 'NOT_DEMAND' };
  }
  const sourceUrl = normalizeString(row.sourceUrl);
  if (!sourceUrl) {
    return { skipReason: 'MISSING_SOURCE_URL' };
  }

  const searchText = buildSearchText(row);
  const matchedKeywords = hitKeywords(searchText, includeKeywords);
  if (matchedKeywords.length === 0) {
    return { skipReason: 'NO_INCLUDE_KEYWORD' };
  }
  if (hitKeywords(searchText, excludeKeywords).length > 0) {
    return { skipReason: 'EXCLUDED_KEYWORD' };
  }

  const companyName = extractCompanyName(row);
  if (!companyName) {
    return { skipReason: 'NO_RELIABLE_COMPANY_NAME' };
  }

  const demandType = resolveDemandType(matchedKeywords);
  const confidenceScore = calculateConfidenceScore({
    companyName,
    hitKeywords: matchedKeywords,
    row,
  });
  const confidenceLevel = resolveConfidenceLevel(confidenceScore);
  if (confidenceScore < 60 || confidenceLevel === 'LOW') {
    return { skipReason: 'LOW_CONFIDENCE' };
  }
  const rawText = [
    buildEvidenceText(row),
    options.rawEvidenceSuffix ? `页面抓取：${options.rawEvidenceSuffix}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const crawledAt =
    options.crawledAt || row.lastSyncedAt || new Date().toISOString();

  const input: ExternalLeadCrawlerUpsertInput = {
    companyName,
    confidenceLevel,
    confidenceScore,
    crawledAt,
    demandType,
    evidences: [
      {
        crawledAt,
        evidenceType: 'NOTICE',
        matchedKeywords,
        matchedSentences: [row.title, row.description]
          .filter(Boolean)
          .map(String),
        publishedAt: row.publishedAt || null,
        rawText,
        scoreDelta: Math.min(30, matchedKeywords.length * 5),
        sourceLink: sourceUrl,
        sourceTitle: row.title || `公开机会 #${row.opportunityId}`,
      },
    ],
    hitKeywords: matchedKeywords,
    industryName: row.industryText || null,
    leadTitle: row.title || `公开机会 #${row.opportunityId}`,
    regionCity: row.city || null,
    regionDistrict: row.district || null,
    regionProvince: null,
    sourceId: row.opportunityId,
    sourceName: options.sourceName || row.sourceSite || 'public_opportunity',
    sourceTitle: row.title || null,
    sourceType: options.sourceType || 'PUBLIC_OPPORTUNITY',
    sourceUrl,
    summary: buildSummary(row),
  };

  return {
    input,
    matchedKeywords,
  };
}

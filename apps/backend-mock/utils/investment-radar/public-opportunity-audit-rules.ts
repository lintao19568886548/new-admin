import {
  GUANGDONG_CITY_SCOPE_PATTERN,
  UNKNOWN_CITY_VALUE_PATTERN,
} from './guangdong-public-scope';

export const AUDIT_PREVIEW_LIMIT = 50;
export const EARLIEST_REASONABLE_PUBLISHED_AT = '2000-01-01 00:00:00';
export const FUTURE_PUBLISHED_TOLERANCE_DAYS = 1;
export const CREATED_PUBLISHED_TOLERANCE_DAYS = 7;
export const TRACEABLE_SOURCE_URL_PATTERN = '^https?://';
export const HASH_OR_DETAIL_FIELD_PATTERN =
  '"(responseHash|sourceSnapshotHash|rawEvidenceText)"[[:space:]]*:';
export const GUANGDONG_REGION_PATTERN = GUANGDONG_CITY_SCOPE_PATTERN;

export type PublicOpportunityAuditDowngradeStatus =
  | 'INVALID'
  | 'OUT_OF_SCOPE'
  | 'SOURCE_LOST'
  | 'UNKNOWN_TIME';

export type AuditCountRow = {
  guangdongValidCount?: bigint | number | string;
  invalidCount?: bigint | number | string;
  missingHashOrDetailEvidenceCount?: bigint | number | string;
  missingPublishedAtCount?: bigint | number | string;
  missingSourceUrlCount?: bigint | number | string;
  missingSupplyLocationCount?: bigint | number | string;
  nonGuangdongCount?: bigint | number | string;
  outOfScopeCount?: bigint | number | string;
  proposedDowngradeCount?: bigint | number | string;
  sourceLostCount?: bigint | number | string;
  suspiciousPublishedAtCount?: bigint | number | string;
  totalCount?: bigint | number | string;
  unknownTimeCount?: bigint | number | string;
};

export type AuditTypeCountRow = AuditCountRow & {
  opportunityType?: null | string;
};

export type AuditPreviewRow = {
  areaText?: null | string;
  city?: null | string;
  createTime?: Date | null | string;
  descriptionPreview?: null | string;
  detailJsonPreview?: null | string;
  district?: null | string;
  isEffective?: bigint | number | string;
  isGuangdong?: bigint | number | string;
  lastSyncedAt?: Date | null | string;
  missingCity?: bigint | number | string;
  missingHashOrDetailEvidence?: bigint | number | string;
  missingPublishedAt?: bigint | number | string;
  missingSourceUrl?: bigint | number | string;
  missingSupplyLocation?: bigint | number | string;
  opportunityId?: bigint | number | string;
  opportunityStatus?: null | string;
  opportunityType?: null | string;
  proposedDowngradeStatus?:
    | null
    | PublicOpportunityAuditDowngradeStatus
    | string;
  publishedAt?: Date | null | string;
  publishedDateText?: null | string;
  score?: bigint | null | number | string;
  sourceId?: bigint | null | number | string;
  sourceKey?: null | string;
  sourceSite?: null | string;
  sourceTable?: null | string;
  sourceUrl?: null | string;
  suspiciousPublishedAt?: bigint | number | string;
  title?: null | string;
  updateTime?: Date | null | string;
};

export interface PublicOpportunityAuditCounts {
  guangdongValidCount: number;
  invalidCount: number;
  missingHashOrDetailEvidenceCount: number;
  missingPublishedAtCount: number;
  missingSourceUrlCount: number;
  missingSupplyLocationCount: number;
  nonGuangdongCount: number;
  outOfScopeCount: number;
  proposedDowngradeCount: number;
  sourceLostCount: number;
  totalCount: number;
  suspiciousPublishedAtCount: number;
  unknownTimeCount: number;
}

export interface PublicOpportunityAuditTypeCounts extends PublicOpportunityAuditCounts {
  opportunityType: string;
  opportunityTypeLabel: string;
}

export interface PublicOpportunityAuditPreviewItem {
  areaText: null | string;
  city: null | string;
  createTime: null | string;
  descriptionPreview: null | string;
  detailJsonPreview: null | string;
  district: null | string;
  issueFlags: {
    missingHashOrDetailEvidence: boolean;
    missingPublishedAt: boolean;
    missingSourceUrl: boolean;
    missingSupplyLocation: boolean;
    nonGuangdong: boolean;
    suspiciousPublishedAt: boolean;
  };
  issueReasons: string[];
  lastSyncedAt: null | string;
  opportunityId: number;
  opportunityStatus: null | string;
  opportunityType: string;
  opportunityTypeLabel: string;
  proposedDowngradeStatus: null | PublicOpportunityAuditDowngradeStatus;
  publishedAt: null | string;
  publishedDateText: null | string;
  score: null | number;
  sourceId: null | string;
  sourceKey: null | string;
  sourceSite: null | string;
  sourceTable: null | string;
  sourceUrl: null | string;
  title: null | string;
  updateTime: null | string;
}

export function buildAuditScopeSql() {
  return `
    SELECT
      audit_base.*,
      CASE
        WHEN isRepairCandidate = 0 THEN NULL
        WHEN missingCity = 1 THEN 'INVALID'
        WHEN isGuangdong = 0 THEN 'OUT_OF_SCOPE'
        WHEN missingSourceUrl = 1 THEN 'SOURCE_LOST'
        WHEN missingPublishedAt = 1 OR suspiciousPublishedAt = 1 THEN 'UNKNOWN_TIME'
        WHEN missingSupplyLocation = 1 THEN 'INVALID'
        WHEN missingHashOrDetailEvidence = 1 THEN 'INVALID'
        ELSE NULL
      END AS proposedDowngradeStatus,
      CASE
        WHEN isEffective = 1
          AND isGuangdong = 1
          AND missingCity = 0
          AND missingSourceUrl = 0
          AND missingPublishedAt = 0
          AND suspiciousPublishedAt = 0
          AND missingSupplyLocation = 0
          AND missingHashOrDetailEvidence = 0
          THEN 1
        ELSE 0
      END AS isStrictlyEffective
      FROM (
        SELECT
          opportunity_id AS opportunityId,
        opportunity_type AS opportunityType,
        source_site AS sourceSite,
        source_url AS sourceUrl,
        source_key AS sourceKey,
        source_table AS sourceTable,
        source_id AS sourceId,
        title,
        city,
        district,
        area_text AS areaText,
        published_at AS publishedAt,
        published_date_text AS publishedDateText,
        opportunity_status AS opportunityStatus,
        score,
        LEFT(description, 300) AS descriptionPreview,
        LEFT(detail_json, 300) AS detailJsonPreview,
        last_synced_at AS lastSyncedAt,
        create_time AS createTime,
        update_time AS updateTime,
        CASE
          WHEN city IS NOT NULL
            AND TRIM(city) <> ''
            AND TRIM(city) NOT REGEXP ?
            AND LOWER(TRIM(city)) NOT REGEXP ?
            THEN 0
          WHEN CONCAT_WS(
            ' ',
            city,
            district,
            area_text,
            title,
            source_site,
            source_url,
            description,
            detail_json
          ) REGEXP ?
            THEN 1
          ELSE 0
        END AS isGuangdong,
        CASE
          WHEN opportunity_status = 'EFFECTIVE' THEN 1
          ELSE 0
        END AS isEffective,
        CASE
          WHEN opportunity_status IN ('EFFECTIVE', 'VERIFIED') THEN 1
          ELSE 0
        END AS isRepairCandidate,
        CASE
          WHEN city IS NULL
            OR TRIM(city) = ''
            OR LOWER(TRIM(city)) REGEXP ?
            THEN 1
          ELSE 0
        END AS missingCity,
        CASE
          WHEN source_url IS NULL
            OR TRIM(source_url) = ''
            OR LOWER(TRIM(source_url)) NOT REGEXP ?
            THEN 1
          ELSE 0
        END AS missingSourceUrl,
        CASE
          WHEN published_at IS NULL THEN 1
          ELSE 0
        END AS missingPublishedAt,
        CASE
          WHEN published_at IS NOT NULL
            AND (
              published_at > DATE_ADD(NOW(3), INTERVAL ? DAY)
              OR published_at < ?
              OR (
                create_time IS NOT NULL
                AND published_at > DATE_ADD(create_time, INTERVAL ? DAY)
              )
            )
            THEN 1
          ELSE 0
        END AS suspiciousPublishedAt,
        CASE
          WHEN detail_json IS NULL
            OR LOWER(TRIM(detail_json)) IN ('', 'null', '{}', '[]')
            OR detail_json NOT REGEXP ?
            THEN 1
          ELSE 0
        END AS missingHashOrDetailEvidence,
        CASE
          WHEN city IS NULL
            OR TRIM(city) = ''
            OR LOWER(TRIM(city)) REGEXP ?
            THEN 1
          WHEN opportunity_type = 'SUPPLY'
            AND (
              district IS NULL
              OR TRIM(district) = ''
            )
            THEN 1
          ELSE 0
        END AS missingSupplyLocation
      FROM investment_public_opportunity
    ) audit_base
  `;
}

export function buildAuditScopeParams() {
  return [
    GUANGDONG_REGION_PATTERN,
    UNKNOWN_CITY_VALUE_PATTERN,
    GUANGDONG_REGION_PATTERN,
    UNKNOWN_CITY_VALUE_PATTERN,
    TRACEABLE_SOURCE_URL_PATTERN,
    FUTURE_PUBLISHED_TOLERANCE_DAYS,
    EARLIEST_REASONABLE_PUBLISHED_AT,
    CREATED_PUBLISHED_TOLERANCE_DAYS,
    HASH_OR_DETAIL_FIELD_PATTERN,
    UNKNOWN_CITY_VALUE_PATTERN,
  ];
}

export function buildStrictEffectiveOpportunityWhereSql(tableAlias = '') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const column = (name: string) => `${prefix}${name}`;

  return `
    ${column('opportunity_status')} = 'EFFECTIVE'
    AND CONCAT_WS(
      ' ',
      ${column('city')},
      ${column('district')},
      ${column('area_text')},
      ${column('title')},
      ${column('source_site')},
      ${column('source_url')},
      ${column('description')},
      ${column('detail_json')}
    ) REGEXP ?
    AND ${column('city')} IS NOT NULL
    AND TRIM(${column('city')}) <> ''
    AND TRIM(${column('city')}) REGEXP ?
    AND ${column('source_url')} IS NOT NULL
    AND TRIM(${column('source_url')}) <> ''
    AND LOWER(TRIM(${column('source_url')})) REGEXP ?
    AND ${column('published_at')} IS NOT NULL
    AND ${column('published_at')} <= DATE_ADD(NOW(3), INTERVAL ? DAY)
    AND ${column('published_at')} >= ?
    AND (
      ${column('opportunity_type')} <> 'SUPPLY'
      OR (
        ${column('district')} IS NOT NULL
        AND TRIM(${column('district')}) <> ''
      )
    )
    AND (
      ${column('create_time')} IS NULL
      OR ${column('published_at')} <= DATE_ADD(
        ${column('create_time')},
        INTERVAL ? DAY
      )
    )
    AND ${column('detail_json')} IS NOT NULL
    AND LOWER(TRIM(${column('detail_json')})) NOT IN ('', 'null', '{}', '[]')
    AND ${column('detail_json')} REGEXP ?
  `;
}

export function buildStrictEffectiveOpportunityWhereParams() {
  return [
    GUANGDONG_REGION_PATTERN,
    GUANGDONG_REGION_PATTERN,
    TRACEABLE_SOURCE_URL_PATTERN,
    FUTURE_PUBLISHED_TOLERANCE_DAYS,
    EARLIEST_REASONABLE_PUBLISHED_AT,
    CREATED_PUBLISHED_TOLERANCE_DAYS,
    HASH_OR_DETAIL_FIELD_PATTERN,
  ];
}

export function toCount(value: unknown) {
  return Number(value || 0);
}

export function toBooleanFlag(value: unknown) {
  return toCount(value) > 0;
}

export function normalizeDate(value: unknown) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

export function normalizeNullableString(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export function normalizeNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function normalizeOpportunityType(value: unknown) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  return normalized || 'UNKNOWN';
}

export function getOpportunityTypeLabel(opportunityType: string) {
  if (opportunityType === 'SUPPLY') {
    return '房源';
  }
  if (opportunityType === 'DEMAND') {
    return '需求';
  }
  return '其他';
}

export function normalizeCounts(
  row: AuditCountRow,
): PublicOpportunityAuditCounts {
  return {
    guangdongValidCount: toCount(row.guangdongValidCount),
    invalidCount: toCount(row.invalidCount),
    missingHashOrDetailEvidenceCount: toCount(
      row.missingHashOrDetailEvidenceCount,
    ),
    missingPublishedAtCount: toCount(row.missingPublishedAtCount),
    missingSourceUrlCount: toCount(row.missingSourceUrlCount),
    missingSupplyLocationCount: toCount(row.missingSupplyLocationCount),
    nonGuangdongCount: toCount(row.nonGuangdongCount),
    outOfScopeCount: toCount(row.outOfScopeCount),
    proposedDowngradeCount: toCount(row.proposedDowngradeCount),
    sourceLostCount: toCount(row.sourceLostCount),
    suspiciousPublishedAtCount: toCount(row.suspiciousPublishedAtCount),
    totalCount: toCount(row.totalCount),
    unknownTimeCount: toCount(row.unknownTimeCount),
  };
}

export function createEmptyTypeCounts(
  opportunityType: string,
): PublicOpportunityAuditTypeCounts {
  return {
    guangdongValidCount: 0,
    invalidCount: 0,
    missingHashOrDetailEvidenceCount: 0,
    missingPublishedAtCount: 0,
    missingSourceUrlCount: 0,
    missingSupplyLocationCount: 0,
    nonGuangdongCount: 0,
    opportunityType,
    opportunityTypeLabel: getOpportunityTypeLabel(opportunityType),
    outOfScopeCount: 0,
    proposedDowngradeCount: 0,
    sourceLostCount: 0,
    suspiciousPublishedAtCount: 0,
    totalCount: 0,
    unknownTimeCount: 0,
  };
}

export function normalizeTypeCounts(
  row: AuditTypeCountRow,
): PublicOpportunityAuditTypeCounts {
  const opportunityType = normalizeOpportunityType(row.opportunityType);
  return {
    ...normalizeCounts(row),
    opportunityType,
    opportunityTypeLabel: getOpportunityTypeLabel(opportunityType),
  };
}

export function buildIssueReasons(row: AuditPreviewRow) {
  const reasons: string[] = [];

  if (!toBooleanFlag(row.isGuangdong)) {
    reasons.push('未识别为广东数据');
  }
  if (toBooleanFlag(row.missingSourceUrl)) {
    reasons.push('缺少可追溯 HTTP(S) 来源链接');
  }
  if (toBooleanFlag(row.missingPublishedAt)) {
    reasons.push('缺少发布时间');
  }
  if (toBooleanFlag(row.suspiciousPublishedAt)) {
    reasons.push('发布时间疑似异常');
  }
  if (toBooleanFlag(row.missingHashOrDetailEvidence)) {
    reasons.push('缺少 hash 或详情证据');
  }

  if (toBooleanFlag(row.missingSupplyLocation)) {
    reasons.push('缺少或未确认广东 21 城城市/房源区域');
  }

  return reasons;
}

export function normalizePreviewItem(
  row: AuditPreviewRow,
): PublicOpportunityAuditPreviewItem {
  const opportunityType = normalizeOpportunityType(row.opportunityType);
  const proposedDowngradeStatus = normalizeDowngradeStatus(
    row.proposedDowngradeStatus,
  );

  return {
    areaText: normalizeNullableString(row.areaText),
    city: normalizeNullableString(row.city),
    createTime: normalizeDate(row.createTime),
    descriptionPreview: normalizeNullableString(row.descriptionPreview),
    detailJsonPreview: normalizeNullableString(row.detailJsonPreview),
    district: normalizeNullableString(row.district),
    issueFlags: {
      missingHashOrDetailEvidence: toBooleanFlag(
        row.missingHashOrDetailEvidence,
      ),
      missingPublishedAt: toBooleanFlag(row.missingPublishedAt),
      missingSourceUrl: toBooleanFlag(row.missingSourceUrl),
      missingSupplyLocation: toBooleanFlag(row.missingSupplyLocation),
      nonGuangdong: !toBooleanFlag(row.isGuangdong),
      suspiciousPublishedAt: toBooleanFlag(row.suspiciousPublishedAt),
    },
    issueReasons: buildIssueReasons(row),
    lastSyncedAt: normalizeDate(row.lastSyncedAt),
    opportunityId: toCount(row.opportunityId),
    opportunityStatus: normalizeNullableString(row.opportunityStatus),
    opportunityType,
    opportunityTypeLabel: getOpportunityTypeLabel(opportunityType),
    proposedDowngradeStatus,
    publishedAt: normalizeDate(row.publishedAt),
    publishedDateText: normalizeNullableString(row.publishedDateText),
    score: normalizeNullableNumber(row.score),
    sourceId:
      row.sourceId === null || row.sourceId === undefined
        ? null
        : String(row.sourceId),
    sourceKey: normalizeNullableString(row.sourceKey),
    sourceSite: normalizeNullableString(row.sourceSite),
    sourceTable: normalizeNullableString(row.sourceTable),
    sourceUrl: normalizeNullableString(row.sourceUrl),
    title: normalizeNullableString(row.title),
    updateTime: normalizeDate(row.updateTime),
  };
}

export function normalizeDowngradeStatus(
  value: unknown,
): null | PublicOpportunityAuditDowngradeStatus {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();

  if (
    normalized === 'INVALID' ||
    normalized === 'OUT_OF_SCOPE' ||
    normalized === 'SOURCE_LOST' ||
    normalized === 'UNKNOWN_TIME'
  ) {
    return normalized;
  }

  return null;
}

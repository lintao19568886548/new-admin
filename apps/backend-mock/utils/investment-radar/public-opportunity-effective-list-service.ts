import type { PublicOpportunityListScope } from './public-opportunity-effective-list-policy';

import { prismaClient } from '~/utils/db';

import {
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES,
  RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES,
  RETIRED_PUBLIC_OPPORTUNITY_SOURCE_SITES,
} from './crawler-types';
import { NON_GUANGDONG_REGION_PATTERN } from './guangdong-public-scope';
import {
  buildAuditScopeParams,
  buildAuditScopeSql,
  GUANGDONG_REGION_PATTERN,
  TRACEABLE_SOURCE_URL_PATTERN,
} from './public-opportunity-audit-rules';
import {
  buildDisplayableCollectedOpportunityWhereSql,
  buildStrictEffectiveOpportunityListWhereParams,
  buildStrictEffectiveOpportunityListWhereSql,
  normalizePublicOpportunityListScope,
} from './public-opportunity-effective-list-policy';
import { ensurePublicOpportunityStorage } from './public-opportunity-repository';
import { serializePublicOpportunityRows } from './public-opportunity-serializer';

const PUBLIC_SOURCE_CODES = [
  PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  ...PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES,
];

const RETIRED_PUBLIC_SOURCE_CODES_SQL_LIST =
  RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES.map(
    (sourceCode) => `'${sourceCode.replaceAll("'", "''")}'`,
  ).join(', ');
const RETIRED_PUBLIC_SOURCE_SITES_SQL_LIST =
  RETIRED_PUBLIC_OPPORTUNITY_SOURCE_SITES.map(
    (sourceSite) => `'${sourceSite.replaceAll("'", "''")}'`,
  ).join(', ');

export interface EffectivePublicOpportunityListParams {
  city: string;
  currentPage: number;
  includeMeta: boolean;
  includeTotal: boolean;
  keyword: string;
  opportunityType: string;
  pageSize: number;
  publishedAgeLabel: string;
  publishedAgeValue: number;
  scope: PublicOpportunityListScope;
  sourceSite: string;
}

export interface EffectivePublicOpportunityQueryPlan {
  clauses: string[];
  directTable: boolean;
  fromSql: string;
  params: any[];
  scope: PublicOpportunityListScope;
}

export interface EffectivePublicOpportunityStats {
  scope: PublicOpportunityListScope;
  strictTotal: number;
  total: number;
}

function toQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim();
  }
  return String(value ?? '').trim();
}

function toQueryBoolean(value: unknown, fallback: boolean) {
  const normalized = toQueryString(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  if (['1', 'on', 'true', 'yes'].includes(normalized)) {
    return true;
  }
  return fallback;
}

export function normalizeEffectivePublicOpportunityListParams(
  query: Record<string, unknown>,
): EffectivePublicOpportunityListParams {
  const currentPage = Math.max(1, Number(query.currentPage || 1));
  const pageSize = Math.max(1, Math.min(500, Number(query.pageSize || 20)));
  const publishedAgeLabel = toQueryString(query.publishedAgeLabel);

  return {
    city: toQueryString(query.city),
    currentPage,
    includeMeta: toQueryBoolean(query.includeMeta, true),
    includeTotal: toQueryBoolean(query.includeTotal, true),
    keyword: toQueryString(query.keyword),
    opportunityType: toQueryString(query.opportunityType).toUpperCase(),
    pageSize,
    publishedAgeLabel,
    publishedAgeValue: Number.parseInt(
      publishedAgeLabel.replaceAll(/\D/g, ''),
      10,
    ),
    scope: normalizePublicOpportunityListScope(query.scope),
    sourceSite: toQueryString(query.sourceSite),
  };
}

function buildJsonSourceCodeFallbackSql(column = 'tags_json') {
  return PUBLIC_SOURCE_CODES.map(
    (sourceCode) =>
      `WHEN CASE
        WHEN JSON_VALID(${column})
          THEN JSON_CONTAINS(${column}, JSON_QUOTE('${sourceCode}'))
        ELSE 0
      END THEN '${sourceCode}'`,
  ).join('\n');
}

function buildSourceSiteFallbackSql(prefix = '') {
  const column = (name: string) => `${prefix}${name}`;

  return `
    WHEN ${column('opportunity_type')} = 'DEMAND' AND ${column('source_site')} = '99cfw'
      THEN 'PUBLIC_DEMAND_99CFW_GD'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = 'cfzsw68.com'
      THEN '${PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE}'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = '99cfw'
      THEN 'PUBLIC_FACTORY_LISTING_99CFW_GD'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = 'fang.com'
      THEN 'PUBLIC_FACTORY_LISTING_FANG_GD'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = 'szaqfdc.com'
      THEN 'PUBLIC_FACTORY_LISTING_SZAQFDC_DG'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = 'toodc.cn'
      THEN 'PUBLIC_FACTORY_LISTING_TOODC_GD'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = 'digitalgd.com.cn'
      THEN 'PUBLIC_FACTORY_LISTING_TZGD_GD'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = 'ttchangfang.com'
      THEN 'PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = 'gdcfzs.com'
      THEN 'PUBLIC_FACTORY_LISTING_GDCFZS_GD'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = 'szcfw.com'
      THEN 'PUBLIC_FACTORY_LISTING_SZCFW_GD'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = 'szkkw.com'
      THEN 'PUBLIC_FACTORY_LISTING_SZKKW_GD'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = 'hfdpt.com'
      THEN 'PUBLIC_FACTORY_LISTING_HFDPT_GD'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = 'changfang88.com'
      THEN 'PUBLIC_FACTORY_LISTING_CHANGFANG88_GD'
    WHEN ${column('opportunity_type')} = 'SUPPLY' AND ${column('source_site')} = 'ysol.com'
      THEN 'PUBLIC_FACTORY_LISTING_YSOL_GD'
    WHEN ${column('opportunity_type')} = 'DEMAND' AND ${column('source_site')} = 'zhaoshang.net'
      THEN 'PUBLIC_DEMAND_ZHAOSHANG_NET_GD'
  `;
}

function buildRetiredPublicOpportunitySql(prefix = '') {
  const column = (name: string) => `${prefix}${name}`;

  return `
    COALESCE(${column('source_code')}, '') NOT IN (${RETIRED_PUBLIC_SOURCE_CODES_SQL_LIST})
    AND COALESCE(${column('source_site')}, '') NOT IN (${RETIRED_PUBLIC_SOURCE_SITES_SQL_LIST})
    AND CASE
      WHEN JSON_VALID(${column('tags_json')})
        THEN NOT (
          ${RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES.map(
            (sourceCode) =>
              `JSON_CONTAINS(${column('tags_json')}, JSON_QUOTE('${sourceCode}'))`,
          ).join(' OR ')}
        )
      ELSE 1
    END
    AND CASE
      WHEN JSON_VALID(${column('detail_json')})
        THEN COALESCE(
          JSON_UNQUOTE(JSON_EXTRACT(${column('detail_json')}, '$.crawlerSourceCode')),
          JSON_UNQUOTE(JSON_EXTRACT(${column('detail_json')}, '$.sourceCode')),
          ''
        ) NOT IN (${RETIRED_PUBLIC_SOURCE_CODES_SQL_LIST})
      ELSE 1
    END
  `;
}

function buildSourceCodeSql(prefix = '') {
  const column = (name: string) => `${prefix}${name}`;

  return `
    COALESCE(
      NULLIF(${column('source_code')}, ''),
      NULLIF(
        CASE
          WHEN JSON_VALID(${column('detail_json')})
            THEN JSON_UNQUOTE(JSON_EXTRACT(${column('detail_json')}, '$.crawlerSourceCode'))
          ELSE NULL
        END,
        ''
      ),
      NULLIF(
        CASE
          WHEN JSON_VALID(${column('detail_json')})
            THEN JSON_UNQUOTE(JSON_EXTRACT(${column('detail_json')}, '$.sourceCode'))
          ELSE NULL
        END,
        ''
      ),
      CASE
        ${buildJsonSourceCodeFallbackSql(column('tags_json'))}
        ${buildSourceSiteFallbackSql(prefix)}
        ELSE NULL
      END
    )
  `;
}

function buildPublishedAgeLabelSql(prefix = '') {
  const publishedAt = `${prefix}published_at`;

  return `
    CASE
      WHEN ${publishedAt} IS NULL THEN NULL
      WHEN TIMESTAMPDIFF(HOUR, ${publishedAt}, NOW()) < 24
        THEN CONCAT(TIMESTAMPDIFF(HOUR, ${publishedAt}, NOW()), ' 小时前')
      ELSE CONCAT(TIMESTAMPDIFF(DAY, ${publishedAt}, NOW()), ' 天前')
    END
  `;
}

function buildReliableSupplySql() {
  return `
    (
      opo.opportunity_type <> 'SUPPLY'
      OR (
        CASE
          WHEN JSON_VALID(opo.detail_json)
            THEN JSON_UNQUOTE(JSON_EXTRACT(opo.detail_json, '$.extractionPolicy'))
          ELSE NULL
        END = 'STRICT_DETAIL_PAGE_LABELS_ONLY'
        AND CASE
          WHEN JSON_VALID(opo.detail_json)
            THEN JSON_UNQUOTE(JSON_EXTRACT(opo.detail_json, '$.responseHash'))
          ELSE NULL
        END IS NOT NULL
      )
    )
  `;
}

function buildReviewableCollectedSql() {
  return `
    opo.source_url IS NOT NULL
    AND TRIM(opo.source_url) <> ''
    AND LOWER(TRIM(opo.source_url)) REGEXP ?
    AND opo.opportunity_status NOT IN ('OUT_OF_SCOPE', 'RAW')
    AND CONCAT_WS(
      ' ',
      opo.city,
      opo.district,
      opo.title,
      opo.source_site,
      opo.source_url
    ) REGEXP ?
    AND CONCAT_WS(
      ' ',
      opo.city,
      opo.district,
      opo.title,
      opo.source_site,
      opo.source_url
    ) NOT REGEXP ?
  `;
}

function buildBaseScopeQuery(
  listScope: PublicOpportunityListScope,
): EffectivePublicOpportunityQueryPlan {
  if (listScope === 'strict') {
    return {
      clauses: [
        buildStrictEffectiveOpportunityListWhereSql('opo'),
        buildReliableSupplySql(),
        buildRetiredPublicOpportunitySql('opo.'),
      ],
      directTable: false,
      fromSql: 'FROM investment_public_opportunity opo',
      params: buildStrictEffectiveOpportunityListWhereParams(),
      scope: listScope,
    };
  }

  if (listScope === 'reviewable') {
    return {
      clauses: [
        buildReviewableCollectedSql(),
        buildRetiredPublicOpportunitySql('opo.'),
      ],
      directTable: false,
      fromSql: 'FROM investment_public_opportunity opo',
      params: [
        TRACEABLE_SOURCE_URL_PATTERN,
        GUANGDONG_REGION_PATTERN,
        NON_GUANGDONG_REGION_PATTERN,
      ],
      scope: listScope,
    };
  }

  return {
    clauses: [
      buildDisplayableCollectedOpportunityWhereSql(),
      buildReliableSupplySql(),
      buildRetiredPublicOpportunitySql('opo.'),
    ],
    directTable: false,
    fromSql: `
      FROM investment_public_opportunity opo
      LEFT JOIN (
        ${buildAuditScopeSql(['EFFECTIVE', 'VERIFIED'])}
      ) audit_scope ON audit_scope.opportunityId = opo.opportunity_id
    `,
    params: buildAuditScopeParams(),
    scope: listScope,
  };
}

function appendQueryFilters(
  params: EffectivePublicOpportunityListParams,
  clauses: string[],
  queryParams: any[],
  options: { skipOpportunityType?: boolean } = {},
) {
  if (params.city) {
    clauses.push('opo.city LIKE ?');
    queryParams.push(`%${params.city}%`);
  }
  if (params.sourceSite) {
    clauses.push('opo.source_site = ?');
    queryParams.push(params.sourceSite);
  }
  if (params.publishedAgeLabel) {
    if (Number.isFinite(params.publishedAgeValue)) {
      if (/hours?|小时/i.test(params.publishedAgeLabel)) {
        clauses.push(
          `opo.published_at IS NOT NULL
            AND opo.published_at <= DATE_SUB(NOW(3), INTERVAL ? HOUR)
            AND opo.published_at > DATE_SUB(NOW(3), INTERVAL ? HOUR)`,
        );
        queryParams.push(
          params.publishedAgeValue,
          params.publishedAgeValue + 1,
        );
      } else {
        clauses.push(
          `opo.published_at IS NOT NULL
            AND opo.published_at <= DATE_SUB(NOW(3), INTERVAL ? DAY)
            AND opo.published_at > DATE_SUB(NOW(3), INTERVAL ? DAY)`,
        );
        queryParams.push(
          params.publishedAgeValue,
          params.publishedAgeValue + 1,
        );
      }
    } else {
      clauses.push(`${buildPublishedAgeLabelSql('opo.')} = ?`);
      queryParams.push(params.publishedAgeLabel);
    }
  }
  if (params.opportunityType && !options.skipOpportunityType) {
    clauses.push('opo.opportunity_type = ?');
    queryParams.push(params.opportunityType);
  }
  if (params.keyword) {
    clauses.push(
      '(opo.title LIKE ? OR opo.contact_name LIKE ? OR opo.phone_number LIKE ? OR opo.source_url LIKE ?)',
    );
    const likeKeyword = `%${params.keyword}%`;
    queryParams.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword);
  }
}

export function buildEffectivePublicOpportunityQueryPlan(
  params: EffectivePublicOpportunityListParams,
  scope = params.scope,
): EffectivePublicOpportunityQueryPlan {
  if (
    scope === 'raw' &&
    (params.opportunityType === 'DEMAND' || params.opportunityType === 'SUPPLY')
  ) {
    const clauses = ['opo.opportunity_type = ?'];
    const queryParams: any[] = [params.opportunityType];
    appendQueryFilters(params, clauses, queryParams, {
      skipOpportunityType: true,
    });

    return {
      clauses,
      directTable: true,
      fromSql: 'FROM investment_public_opportunity opo',
      params: queryParams,
      scope,
    };
  }

  if (
    scope === 'collected' &&
    (params.opportunityType === 'DEMAND' || params.opportunityType === 'SUPPLY')
  ) {
    const clauses = [
      'opo.opportunity_type = ?',
      "opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')",
      'opo.source_url IS NOT NULL',
      "TRIM(opo.source_url) <> ''",
      'opo.published_at IS NOT NULL',
      buildRecentPublishedAtSql('opo'),
      buildRetiredPublicOpportunitySql('opo.'),
    ];
    const queryParams: any[] = [params.opportunityType];
    appendQueryFilters(params, clauses, queryParams, {
      skipOpportunityType: true,
    });

    return {
      clauses,
      directTable: true,
      fromSql: 'FROM investment_public_opportunity opo',
      params: queryParams,
      scope,
    };
  }

  if (
    scope === 'strict' &&
    (params.opportunityType === 'DEMAND' || params.opportunityType === 'SUPPLY')
  ) {
    const clauses = [
      'opo.opportunity_type = ?',
      buildStrictEffectiveOpportunityListWhereSql('opo'),
      buildRetiredPublicOpportunitySql('opo.'),
    ];
    const queryParams: any[] = [
      params.opportunityType,
      ...buildStrictEffectiveOpportunityListWhereParams(),
    ];
    if (params.opportunityType === 'SUPPLY') {
      clauses.push(buildReliableSupplySql());
    }

    appendQueryFilters(params, clauses, queryParams, {
      skipOpportunityType: true,
    });

    return {
      clauses,
      directTable: true,
      fromSql: 'FROM investment_public_opportunity opo',
      params: queryParams,
      scope,
    };
  }

  const query = buildBaseScopeQuery(scope);
  appendQueryFilters(params, query.clauses, query.params);
  return query;
}

export function buildEffectivePublicOpportunityDedupedSql(
  query: EffectivePublicOpportunityQueryPlan,
) {
  return `
    SELECT *
    FROM (
      SELECT
        opo.*,
        ROW_NUMBER() OVER (
          PARTITION BY opo.opportunity_type, COALESCE(NULLIF(opo.source_url, ''), CONCAT('id:', opo.opportunity_id))
          ORDER BY
            opo.last_synced_at DESC,
            CASE WHEN opo.published_at IS NULL THEN 1 ELSE 0 END ASC,
            opo.published_at DESC,
            opo.opportunity_id DESC
        ) AS dedupe_rank
      ${query.fromSql}
      WHERE ${query.clauses.join(' AND ')}
    ) deduped
    WHERE dedupe_rank = 1
  `;
}

function buildEffectivePublicOpportunityCountSql(
  query: EffectivePublicOpportunityQueryPlan,
) {
  if (query.directTable) {
    return `
      SELECT COUNT(*) AS total
      ${query.fromSql}
      WHERE ${query.clauses.join(' AND ')}
    `;
  }

  return `
    SELECT COUNT(*) AS total
    FROM (${buildEffectivePublicOpportunityDedupedSql(query)}) count_scope
  `;
}

function buildDirectListSql(
  whereSql: string,
  options?: { fastSourceCode?: boolean },
) {
  const sourceCodeSql = options?.fastSourceCode
    ? 'opo.source_code'
    : buildSourceCodeSql('opo.');

  return `
    SELECT
      opo.opportunity_id AS opportunityId,
      opo.opportunity_type AS opportunityType,
      opo.source_site AS sourceSite,
      opo.source_url AS sourceUrl,
      opo.source_table AS sourceTable,
      opo.source_id AS sourceId,
      ${sourceCodeSql} AS sourceCode,
      opo.title,
      opo.city,
      opo.district,
      opo.area_text AS areaText,
      opo.area_sqm AS areaSqm,
      opo.price_text AS priceText,
      opo.industry_text AS industryText,
      opo.contact_name AS contactName,
      opo.phone_number AS phoneNumber,
      opo.description,
      opo.published_at AS publishedAt,
      opo.published_date_text AS publishedDateText,
      opo.effective_until AS effectiveUntil,
      opo.opportunity_status AS opportunityStatus,
      opo.is_guangdong AS isGuangdong,
      opo.has_detail_evidence AS hasDetailEvidence,
      opo.quality_grade AS qualityGrade,
      opo.score,
      opo.tags_json AS tagsJson,
      opo.detail_json AS detailJson,
      opo.last_synced_at AS lastSyncedAt,
      ${buildPublishedAgeLabelSql('opo.')} AS publishedAgeLabel
    FROM investment_public_opportunity opo
    WHERE ${whereSql}
    ORDER BY
      opo.published_at DESC,
      opo.last_synced_at DESC,
      opo.opportunity_id DESC
    LIMIT ? OFFSET ?
  `;
}

function buildDedupedListSql(dedupedSql: string) {
  return `
    SELECT
      opportunity_id AS opportunityId,
      opportunity_type AS opportunityType,
      source_site AS sourceSite,
      source_url AS sourceUrl,
      source_table AS sourceTable,
      source_id AS sourceId,
      ${buildSourceCodeSql()} AS sourceCode,
      title,
      city,
      district,
      area_text AS areaText,
      area_sqm AS areaSqm,
      price_text AS priceText,
      industry_text AS industryText,
      contact_name AS contactName,
      phone_number AS phoneNumber,
      description,
      published_at AS publishedAt,
      published_date_text AS publishedDateText,
      effective_until AS effectiveUntil,
      opportunity_status AS opportunityStatus,
      is_guangdong AS isGuangdong,
      has_detail_evidence AS hasDetailEvidence,
      quality_grade AS qualityGrade,
      score,
      tags_json AS tagsJson,
      detail_json AS detailJson,
      last_synced_at AS lastSyncedAt,
      ${buildPublishedAgeLabelSql()} AS publishedAgeLabel
    FROM (${dedupedSql}) list_scope
    ORDER BY
      CASE WHEN published_at IS NULL THEN 1 ELSE 0 END ASC,
      published_at DESC,
      last_synced_at DESC,
      opportunity_id DESC
    LIMIT ? OFFSET ?
  `;
}

async function countEffectivePublicOpportunities(
  query: EffectivePublicOpportunityQueryPlan,
) {
  const countRows = await prismaClient.$queryRawUnsafe<
    Array<{ total: bigint | number }>
  >(buildEffectivePublicOpportunityCountSql(query), ...query.params);
  return Number(countRows[0]?.total || 0);
}

export async function getEffectivePublicOpportunityStats(
  params: EffectivePublicOpportunityListParams,
): Promise<EffectivePublicOpportunityStats> {
  await ensurePublicOpportunityStorage();

  const scopedQuery = buildEffectivePublicOpportunityQueryPlan(params);
  const total = await countEffectivePublicOpportunities(scopedQuery);
  if (params.scope === 'reviewable' || params.scope === 'strict') {
    return {
      scope: params.scope,
      strictTotal: params.scope === 'strict' ? total : 0,
      total,
    };
  }

  const strictQuery = buildEffectivePublicOpportunityQueryPlan(
    params,
    'strict',
  );
  const strictTotal = await countEffectivePublicOpportunities(strictQuery);
  return {
    scope: params.scope,
    strictTotal,
    total,
  };
}

export async function getEffectivePublicOpportunityOptions(
  params: EffectivePublicOpportunityListParams,
) {
  await ensurePublicOpportunityStorage();

  const scopedQuery = buildEffectivePublicOpportunityQueryPlan(params);
  if (scopedQuery.directTable) {
    const whereSql = scopedQuery.clauses.join(' AND ');
    const [sourceSiteRows, publishedAgeRows] = await Promise.all([
      prismaClient.$queryRawUnsafe<Array<{ value?: null | string }>>(
        `
          SELECT DISTINCT opo.source_site AS value
          FROM investment_public_opportunity opo
          WHERE ${whereSql}
            AND opo.source_site IS NOT NULL
            AND opo.source_site <> ''
          ORDER BY opo.source_site ASC
          LIMIT 100
        `,
        ...scopedQuery.params,
      ),
      prismaClient.$queryRawUnsafe<
        Array<{ sortValue: bigint | number; value?: null | string }>
      >(
        `
          SELECT
            ${buildPublishedAgeLabelSql('opo.')} AS value,
            MIN(TIMESTAMPDIFF(HOUR, opo.published_at, NOW())) AS sortValue
          FROM investment_public_opportunity opo
          WHERE ${whereSql}
          GROUP BY value
          HAVING value IS NOT NULL AND value <> ''
          ORDER BY sortValue ASC
          LIMIT 100
        `,
        ...scopedQuery.params,
      ),
    ]);
    return {
      filters: {
        publishedAgeLabels: publishedAgeRows
          .map((row) => String(row.value || '').trim())
          .filter(Boolean),
        sourceSites: sourceSiteRows
          .map((row) => String(row.value || '').trim())
          .filter(Boolean),
      },
      scope: params.scope,
    };
  }

  const dedupedSql = buildEffectivePublicOpportunityDedupedSql(scopedQuery);
  const [sourceSiteRows, publishedAgeRows] = await Promise.all([
    prismaClient.$queryRawUnsafe<Array<{ value?: null | string }>>(
      `
        SELECT DISTINCT source_site AS value
        FROM (${dedupedSql}) source_scope
        WHERE source_site IS NOT NULL
          AND source_site <> ''
        ORDER BY source_site ASC
        LIMIT 100
      `,
      ...scopedQuery.params,
    ),
    prismaClient.$queryRawUnsafe<
      Array<{ sortValue: bigint | number; value?: null | string }>
    >(
      `
        SELECT
          ${buildPublishedAgeLabelSql()} AS value,
          MIN(TIMESTAMPDIFF(HOUR, published_at, NOW())) AS sortValue
        FROM (${dedupedSql}) age_scope
        WHERE published_at IS NOT NULL
        GROUP BY value
        HAVING value IS NOT NULL AND value <> ''
        ORDER BY sortValue ASC
        LIMIT 100
      `,
      ...scopedQuery.params,
    ),
  ]);

  return {
    filters: {
      publishedAgeLabels: publishedAgeRows
        .map((row) => String(row.value || '').trim())
        .filter(Boolean),
      sourceSites: sourceSiteRows
        .map((row) => String(row.value || '').trim())
        .filter(Boolean),
    },
    scope: params.scope,
  };
}

export async function listEffectivePublicOpportunities(
  params: EffectivePublicOpportunityListParams,
) {
  await ensurePublicOpportunityStorage();

  const scopedQuery = buildEffectivePublicOpportunityQueryPlan(params);
  const offset = (params.currentPage - 1) * params.pageSize;
  const listSql = scopedQuery.directTable
    ? buildDirectListSql(scopedQuery.clauses.join(' AND '), {
        fastSourceCode: params.scope === 'raw',
      })
    : buildDedupedListSql(
        buildEffectivePublicOpportunityDedupedSql(scopedQuery),
      );
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    listSql,
    ...scopedQuery.params,
    params.pageSize,
    offset,
  );
  const items = serializePublicOpportunityRows(rows);

  if (!params.includeMeta) {
    if (!params.includeTotal) {
      const knownTotal =
        params.currentPage === 1 && items.length < params.pageSize
          ? items.length
          : undefined;
      return {
        items,
        page: {
          currentPage: params.currentPage,
          pageSize: params.pageSize,
          ...(knownTotal === undefined ? {} : { total: knownTotal }),
        },
        scope: params.scope,
        ...(knownTotal === undefined ? {} : { total: knownTotal }),
        totalKnown: knownTotal !== undefined,
      };
    }

    const total = await countEffectivePublicOpportunities(scopedQuery);
    return {
      items,
      page: {
        currentPage: params.currentPage,
        pageSize: params.pageSize,
        total,
      },
      scope: params.scope,
      total,
    };
  }

  const [stats, options] = await Promise.all([
    getEffectivePublicOpportunityStats(params),
    getEffectivePublicOpportunityOptions(params),
  ]);

  return {
    filters: options.filters,
    items,
    page: {
      currentPage: params.currentPage,
      pageSize: params.pageSize,
      total: stats.total,
    },
    scope: params.scope,
    strictTotal: stats.strictTotal,
    total: stats.total,
  };
}

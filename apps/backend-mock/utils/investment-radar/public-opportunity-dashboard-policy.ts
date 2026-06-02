import {
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES,
  RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES,
  RETIRED_PUBLIC_OPPORTUNITY_SOURCE_SITES,
} from './crawler-types';
import { buildStrictMaterializedEffectiveOpportunityWhereSql } from './public-opportunity-effective-list-policy';

export function buildDashboardJsonSourceCodeFallbackSql(
  column = 'opo.tags_json',
) {
  return PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.map(
    (sourceCode) =>
      `WHEN JSON_CONTAINS(${column}, JSON_QUOTE('${sourceCode}')) THEN '${sourceCode}'`,
  ).join('\n');
}

export function buildDashboardSourceSiteFallbackSql(alias = 'opo') {
  return `
    WHEN ${alias}.opportunity_type = 'DEMAND' AND ${alias}.source_site = '99cfw'
      THEN 'PUBLIC_DEMAND_99CFW_GD'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = 'cfzsw68.com'
      THEN '${PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE}'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = '99cfw'
      THEN 'PUBLIC_FACTORY_LISTING_99CFW_GD'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = 'fang.com'
      THEN 'PUBLIC_FACTORY_LISTING_FANG_GD'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = 'szaqfdc.com'
      THEN 'PUBLIC_FACTORY_LISTING_SZAQFDC_DG'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = 'toodc.cn'
      THEN 'PUBLIC_FACTORY_LISTING_TOODC_GD'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = 'digitalgd.com.cn'
      THEN 'PUBLIC_FACTORY_LISTING_TZGD_GD'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = 'ttchangfang.com'
      THEN 'PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = 'gdcfzs.com'
      THEN 'PUBLIC_FACTORY_LISTING_GDCFZS_GD'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = 'szcfw.com'
      THEN 'PUBLIC_FACTORY_LISTING_SZCFW_GD'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = 'szkkw.com'
      THEN 'PUBLIC_FACTORY_LISTING_SZKKW_GD'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = 'hfdpt.com'
      THEN 'PUBLIC_FACTORY_LISTING_HFDPT_GD'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = 'changfang88.com'
      THEN 'PUBLIC_FACTORY_LISTING_CHANGFANG88_GD'
    WHEN ${alias}.opportunity_type = 'SUPPLY' AND ${alias}.source_site = 'ysol.com'
      THEN 'PUBLIC_FACTORY_LISTING_YSOL_GD'
    WHEN ${alias}.opportunity_type = 'DEMAND' AND ${alias}.source_site = 'zhaoshang.net'
      THEN 'PUBLIC_DEMAND_ZHAOSHANG_NET_GD'
  `;
}

export function buildDashboardSourceCodeSql(alias = 'opo') {
  return `
    COALESCE(
      NULLIF(${alias}.source_code, ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(${alias}.detail_json, '$.crawlerSourceCode')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(${alias}.detail_json, '$.sourceCode')), ''),
      CASE
        ${buildDashboardJsonSourceCodeFallbackSql(`${alias}.tags_json`)}
        ${buildDashboardSourceSiteFallbackSql(alias)}
        ELSE NULL
      END
    )
  `;
}

export function buildDashboardReliableSupplySql(alias = 'opo') {
  return `
    (
      ${alias}.opportunity_type <> 'SUPPLY'
      OR (
        JSON_UNQUOTE(JSON_EXTRACT(${alias}.detail_json, '$.extractionPolicy')) = 'STRICT_DETAIL_PAGE_LABELS_ONLY'
        AND JSON_UNQUOTE(JSON_EXTRACT(${alias}.detail_json, '$.responseHash')) IS NOT NULL
      )
    )
  `;
}

function buildDashboardRecentPublishedAtSql(alias = 'opo') {
  return `${alias}.published_at >= DATE_SUB(NOW(3), INTERVAL 180 DAY)`;
}

function buildDashboardRetiredPublicOpportunitySql(alias = 'opo') {
  const retiredSourceCodes = RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES.map(
    (sourceCode) => `'${sourceCode.replaceAll("'", "''")}'`,
  ).join(', ');
  const retiredSourceSites = RETIRED_PUBLIC_OPPORTUNITY_SOURCE_SITES.map(
    (sourceSite) => `'${sourceSite.replaceAll("'", "''")}'`,
  ).join(', ');

  return `
    COALESCE(${alias}.source_code, '') NOT IN (${retiredSourceCodes})
    AND COALESCE(${alias}.source_site, '') NOT IN (${retiredSourceSites})
    AND CASE
      WHEN JSON_VALID(${alias}.tags_json)
        THEN NOT (
          ${RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES.map(
            (sourceCode) =>
              `JSON_CONTAINS(${alias}.tags_json, JSON_QUOTE('${sourceCode}'))`,
          ).join(' OR ')}
        )
      ELSE 1
    END
    AND CASE
      WHEN JSON_VALID(${alias}.detail_json)
        THEN COALESCE(
          JSON_UNQUOTE(JSON_EXTRACT(${alias}.detail_json, '$.crawlerSourceCode')),
          JSON_UNQUOTE(JSON_EXTRACT(${alias}.detail_json, '$.sourceCode')),
          ''
        ) NOT IN (${retiredSourceCodes})
      ELSE 1
    END
  `;
}

export function buildDashboardEffectiveSql(auditScopeSql: string) {
  return `
    SELECT *
    FROM (
      SELECT
        opo.*,
        ${buildDashboardSourceCodeSql('opo')} AS sourceCode,
        ROW_NUMBER() OVER (
          PARTITION BY opo.opportunity_type, COALESCE(NULLIF(opo.source_url, ''), CONCAT('id:', opo.opportunity_id))
          ORDER BY opo.last_synced_at DESC, opo.opportunity_id DESC
        ) AS dedupeRank
      FROM investment_public_opportunity opo
      LEFT JOIN (${auditScopeSql}) audit_scope
        ON audit_scope.opportunityId = opo.opportunity_id
      WHERE opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')
        AND (
          (
            opo.quality_grade IN ('EFFECTIVE', 'VERIFIED')
            AND opo.is_guangdong = 1
            AND opo.has_detail_evidence = 1
            AND opo.city IS NOT NULL
            AND TRIM(opo.city) <> ''
            AND opo.source_url IS NOT NULL
            AND TRIM(opo.source_url) <> ''
            AND opo.published_at IS NOT NULL
            AND ${buildDashboardRecentPublishedAtSql('opo')}
            AND (
              opo.opportunity_type <> 'SUPPLY'
              OR (
                opo.district IS NOT NULL
                AND TRIM(opo.district) <> ''
              )
            )
          )
          OR (
            audit_scope.opportunityId IS NOT NULL
            AND (
              opo.quality_grade IS NULL
              OR TRIM(opo.quality_grade) = ''
            )
            AND audit_scope.isGuangdong = 1
            AND audit_scope.missingCity = 0
            AND audit_scope.missingSourceUrl = 0
            AND audit_scope.missingPublishedAt = 0
            AND audit_scope.suspiciousPublishedAt = 0
            AND ${buildDashboardRecentPublishedAtSql('opo')}
            AND audit_scope.missingSupplyLocation = 0
            AND audit_scope.missingHashOrDetailEvidence = 0
          )
        )
        AND ${buildDashboardReliableSupplySql('opo')}
        AND ${buildDashboardRetiredPublicOpportunitySql('opo')}
    ) effective_scope
    WHERE dedupeRank = 1
  `;
}

export function buildMaterializedDashboardEffectiveSql() {
  return `
    SELECT
      opo.*,
      ${buildDashboardSourceCodeSql('opo')} AS sourceCode
    FROM investment_public_opportunity opo
    WHERE ${buildStrictMaterializedEffectiveOpportunityWhereSql('opo')}
  `;
}

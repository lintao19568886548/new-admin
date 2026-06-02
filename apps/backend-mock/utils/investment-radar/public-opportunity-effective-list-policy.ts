import {
  buildPublishedObservedAtSql,
  buildStrictEffectiveOpportunityWhereParams,
  buildStrictEffectiveOpportunityWhereSql,
  CREATED_PUBLISHED_TOLERANCE_DAYS,
  EARLIEST_REASONABLE_PUBLISHED_AT,
  FUTURE_PUBLISHED_TOLERANCE_DAYS,
  TRACEABLE_SOURCE_URL_PATTERN,
} from './public-opportunity-audit-rules';

export type PublicOpportunityListScope =
  | 'collected'
  | 'raw'
  | 'reviewable'
  | 'strict';

export function buildRecentPublishedAtSql(opportunityAlias = 'opo') {
  return `${opportunityAlias}.published_at >= DATE_SUB(NOW(3), INTERVAL 180 DAY)`;
}

export function normalizePublicOpportunityListScope(
  value: unknown,
): PublicOpportunityListScope {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (normalized === 'collected') {
    return 'collected';
  }
  if (normalized === 'raw') {
    return 'raw';
  }
  if (normalized === 'reviewable') {
    return 'reviewable';
  }
  return 'strict';
}

export function buildDisplayableCollectedOpportunityWhereSql(
  opportunityAlias = 'opo',
  auditScopeAlias = 'audit_scope',
) {
  return `
        ${opportunityAlias}.opportunity_status IN ('EFFECTIVE', 'VERIFIED')
        AND (
          (
            ${opportunityAlias}.quality_grade IN ('EFFECTIVE', 'VERIFIED')
            AND ${opportunityAlias}.is_guangdong = 1
            AND ${opportunityAlias}.has_detail_evidence = 1
            AND ${opportunityAlias}.city IS NOT NULL
            AND TRIM(${opportunityAlias}.city) <> ''
            AND ${opportunityAlias}.source_url IS NOT NULL
            AND TRIM(${opportunityAlias}.source_url) <> ''
            AND ${opportunityAlias}.published_at IS NOT NULL
            AND ${buildRecentPublishedAtSql(opportunityAlias)}
            AND (
              ${opportunityAlias}.opportunity_type <> 'SUPPLY'
              OR (
                ${opportunityAlias}.district IS NOT NULL
                AND TRIM(${opportunityAlias}.district) <> ''
              )
            )
          )
          OR (
            ${auditScopeAlias}.opportunityId IS NOT NULL
            AND (
              ${opportunityAlias}.quality_grade IS NULL
              OR TRIM(${opportunityAlias}.quality_grade) = ''
            )
            AND ${auditScopeAlias}.isGuangdong = 1
            AND ${auditScopeAlias}.missingCity = 0
            AND ${auditScopeAlias}.missingSourceUrl = 0
            AND ${auditScopeAlias}.missingPublishedAt = 0
            AND ${auditScopeAlias}.suspiciousPublishedAt = 0
            AND ${buildRecentPublishedAtSql(opportunityAlias)}
            AND ${auditScopeAlias}.missingSupplyLocation = 0
            AND ${auditScopeAlias}.missingHashOrDetailEvidence = 0
          )
        )
      `;
}

export function buildStrictMaterializedEffectiveOpportunityWhereSql(
  opportunityAlias = 'opo',
) {
  return `
        ${opportunityAlias}.opportunity_status IN ('EFFECTIVE', 'VERIFIED')
        AND ${opportunityAlias}.quality_grade IN ('EFFECTIVE', 'VERIFIED')
        AND ${opportunityAlias}.is_guangdong = 1
        AND ${opportunityAlias}.has_detail_evidence = 1
        AND ${opportunityAlias}.city IS NOT NULL
        AND TRIM(${opportunityAlias}.city) <> ''
        AND ${opportunityAlias}.source_url IS NOT NULL
        AND TRIM(${opportunityAlias}.source_url) <> ''
        AND LOWER(TRIM(${opportunityAlias}.source_url)) REGEXP ?
        AND ${opportunityAlias}.published_at IS NOT NULL
        AND ${buildRecentPublishedAtSql(opportunityAlias)}
        AND ${opportunityAlias}.published_at <= DATE_ADD(NOW(3), INTERVAL ? DAY)
        AND ${opportunityAlias}.published_at >= ?
        AND (
          ${opportunityAlias}.opportunity_type <> 'SUPPLY'
          OR (
            ${opportunityAlias}.district IS NOT NULL
            AND TRIM(${opportunityAlias}.district) <> ''
          )
        )
        AND (
          ${buildPublishedObservedAtSql(opportunityAlias)} IS NULL
          OR ${opportunityAlias}.published_at <= DATE_ADD(
            ${buildPublishedObservedAtSql(opportunityAlias)},
            INTERVAL ? DAY
          )
        )
      `;
}

export function buildStrictMaterializedEffectiveOpportunityWhereParams() {
  return [
    TRACEABLE_SOURCE_URL_PATTERN,
    FUTURE_PUBLISHED_TOLERANCE_DAYS,
    EARLIEST_REASONABLE_PUBLISHED_AT,
    CREATED_PUBLISHED_TOLERANCE_DAYS,
  ];
}

export function buildStrictEffectiveOpportunityListWhereSql(
  opportunityAlias = 'opo',
) {
  return `
        (
          (
            ${buildStrictMaterializedEffectiveOpportunityWhereSql(opportunityAlias)}
          )
          OR (
            (
              ${opportunityAlias}.quality_grade IS NULL
              OR TRIM(${opportunityAlias}.quality_grade) = ''
            )
            AND ${buildStrictEffectiveOpportunityWhereSql(opportunityAlias)}
          )
        )
      `;
}

export function buildStrictEffectiveOpportunityListWhereParams() {
  return [
    ...buildStrictMaterializedEffectiveOpportunityWhereParams(),
    ...buildStrictEffectiveOpportunityWhereParams(),
  ];
}

export function buildStrictDemandEffectiveOpportunityWhereSql(
  opportunityAlias = 'opo',
) {
  return `
        ${opportunityAlias}.opportunity_type = 'DEMAND'
        AND ${opportunityAlias}.opportunity_status = 'EFFECTIVE'
        AND ${opportunityAlias}.source_url IS NOT NULL
        AND TRIM(${opportunityAlias}.source_url) <> ''
        AND LOWER(TRIM(${opportunityAlias}.source_url)) REGEXP ?
        AND ${opportunityAlias}.city IS NOT NULL
        AND TRIM(${opportunityAlias}.city) <> ''
        AND ${opportunityAlias}.published_at IS NOT NULL
        AND ${buildRecentPublishedAtSql(opportunityAlias)}
        AND ${opportunityAlias}.detail_json IS NOT NULL
        AND LOWER(TRIM(${opportunityAlias}.detail_json)) NOT IN ('', 'null', '{}', '[]')
      `;
}

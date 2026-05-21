import type {
  AuditCountRow,
  AuditPreviewRow,
  AuditTypeCountRow,
  PublicOpportunityAuditCounts,
  PublicOpportunityAuditPreviewItem,
  PublicOpportunityAuditTypeCounts,
} from './public-opportunity-audit-rules';

import { prismaClient } from '~/utils/db';

import {
  AUDIT_PREVIEW_LIMIT,
  buildAuditScopeParams,
  buildAuditScopeSql,
  createEmptyTypeCounts,
  normalizeCounts,
  normalizePreviewItem,
  normalizeTypeCounts,
} from './public-opportunity-audit-rules';

export type {
  PublicOpportunityAuditCounts,
  PublicOpportunityAuditPreviewItem,
  PublicOpportunityAuditTypeCounts,
};

export async function getPublicOpportunityAuditSummary() {
  const auditScopeSql = buildAuditScopeSql();
  const auditScopeParams = buildAuditScopeParams();

  const [summaryRows, typeRows] = await Promise.all([
    prismaClient.$queryRawUnsafe<AuditCountRow[]>(
      `
        SELECT
          COUNT(*) AS totalCount,
          SUM(isStrictlyEffective) AS guangdongValidCount,
          SUM(CASE WHEN isGuangdong = 0 THEN 1 ELSE 0 END) AS nonGuangdongCount,
          SUM(missingSourceUrl) AS missingSourceUrlCount,
          SUM(missingSupplyLocation) AS missingSupplyLocationCount,
          SUM(missingPublishedAt) AS missingPublishedAtCount,
          SUM(suspiciousPublishedAt) AS suspiciousPublishedAtCount,
          SUM(missingHashOrDetailEvidence) AS missingHashOrDetailEvidenceCount,
          SUM(CASE WHEN proposedDowngradeStatus IS NOT NULL THEN 1 ELSE 0 END) AS proposedDowngradeCount,
          SUM(CASE WHEN proposedDowngradeStatus = 'OUT_OF_SCOPE' THEN 1 ELSE 0 END) AS outOfScopeCount,
          SUM(CASE WHEN proposedDowngradeStatus = 'SOURCE_LOST' THEN 1 ELSE 0 END) AS sourceLostCount,
          SUM(CASE WHEN proposedDowngradeStatus = 'UNKNOWN_TIME' THEN 1 ELSE 0 END) AS unknownTimeCount,
          SUM(CASE WHEN proposedDowngradeStatus = 'INVALID' THEN 1 ELSE 0 END) AS invalidCount
        FROM (${auditScopeSql}) audit_scope
      `,
      ...auditScopeParams,
    ),
    prismaClient.$queryRawUnsafe<AuditTypeCountRow[]>(
      `
        SELECT
          opportunityType,
          COUNT(*) AS totalCount,
          SUM(isStrictlyEffective) AS guangdongValidCount,
          SUM(CASE WHEN isGuangdong = 0 THEN 1 ELSE 0 END) AS nonGuangdongCount,
          SUM(missingSourceUrl) AS missingSourceUrlCount,
          SUM(missingSupplyLocation) AS missingSupplyLocationCount,
          SUM(missingPublishedAt) AS missingPublishedAtCount,
          SUM(suspiciousPublishedAt) AS suspiciousPublishedAtCount,
          SUM(missingHashOrDetailEvidence) AS missingHashOrDetailEvidenceCount,
          SUM(CASE WHEN proposedDowngradeStatus IS NOT NULL THEN 1 ELSE 0 END) AS proposedDowngradeCount,
          SUM(CASE WHEN proposedDowngradeStatus = 'OUT_OF_SCOPE' THEN 1 ELSE 0 END) AS outOfScopeCount,
          SUM(CASE WHEN proposedDowngradeStatus = 'SOURCE_LOST' THEN 1 ELSE 0 END) AS sourceLostCount,
          SUM(CASE WHEN proposedDowngradeStatus = 'UNKNOWN_TIME' THEN 1 ELSE 0 END) AS unknownTimeCount,
          SUM(CASE WHEN proposedDowngradeStatus = 'INVALID' THEN 1 ELSE 0 END) AS invalidCount
        FROM (${auditScopeSql}) audit_scope
        GROUP BY opportunityType
        ORDER BY opportunityType ASC
      `,
      ...auditScopeParams,
    ),
  ]);

  const typeStats: Record<string, PublicOpportunityAuditTypeCounts> = {
    DEMAND: createEmptyTypeCounts('DEMAND'),
    SUPPLY: createEmptyTypeCounts('SUPPLY'),
  };

  for (const row of typeRows) {
    const normalized = normalizeTypeCounts(row);
    typeStats[normalized.opportunityType] = normalized;
  }

  return {
    auditMode: 'DRY_RUN',
    dryRun: true,
    generatedAt: new Date().toISOString(),
    summary: normalizeCounts(summaryRows[0] || {}),
    typeStats,
  };
}

export async function getPublicOpportunityAuditPreview() {
  const auditScopeSql = buildAuditScopeSql();
  const auditScopeParams = buildAuditScopeParams();
  const issueWhereSql = `
    proposedDowngradeStatus IS NOT NULL
  `;
  const [totalRows, rows] = await Promise.all([
    prismaClient.$queryRawUnsafe<AuditCountRow[]>(
      `
        SELECT COUNT(*) AS totalCount
        FROM (${auditScopeSql}) audit_scope
        WHERE ${issueWhereSql}
      `,
      ...auditScopeParams,
    ),
    prismaClient.$queryRawUnsafe<AuditPreviewRow[]>(
      `
        SELECT
          opportunityId,
          opportunityType,
          sourceSite,
          sourceUrl,
          sourceKey,
          sourceTable,
          sourceId,
          title,
          city,
          district,
          areaText,
          publishedAt,
          publishedDateText,
          opportunityStatus,
          score,
          descriptionPreview,
          detailJsonPreview,
          lastSyncedAt,
          createTime,
          updateTime,
          isGuangdong,
          isEffective,
          missingSourceUrl,
          missingSupplyLocation,
          missingPublishedAt,
          suspiciousPublishedAt,
          missingHashOrDetailEvidence,
          proposedDowngradeStatus
        FROM (${auditScopeSql}) audit_scope
        WHERE ${issueWhereSql}
        ORDER BY
          (
            (CASE WHEN isGuangdong = 0 THEN 16 ELSE 0 END)
            + (missingSourceUrl * 8)
            + (missingSupplyLocation * 6)
            + (missingPublishedAt * 4)
            + (suspiciousPublishedAt * 2)
            + missingHashOrDetailEvidence
          ) DESC,
          opportunityId ASC
        LIMIT ?
      `,
      ...auditScopeParams,
      AUDIT_PREVIEW_LIMIT,
    ),
  ]);

  return {
    auditMode: 'DRY_RUN',
    dryRun: true,
    generatedAt: new Date().toISOString(),
    items: rows.map((row) => normalizePreviewItem(row)),
    limit: AUDIT_PREVIEW_LIMIT,
    totalPreviewCount: normalizeCounts(totalRows[0] || {}).totalCount,
  };
}

import type {
  AuditCountRow,
  AuditPreviewRow,
  PublicOpportunityAuditCounts,
  PublicOpportunityAuditDowngradeStatus,
} from './public-opportunity-audit-rules';

import { prismaClient } from '~/utils/db';
import { ensurePublicOpportunityStorage } from '~/utils/investment-radar/public-opportunity-repository';

import {
  AUDIT_PREVIEW_LIMIT,
  buildAuditScopeParams,
  buildAuditScopeSql,
  normalizeCounts,
  normalizeDowngradeStatus,
  normalizePreviewItem,
  toCount,
} from './public-opportunity-audit-rules';

const REPAIR_REASON_CODES = {
  INVALID: 'CITY_MISSING_OR_UNCONFIRMED_OR_DETAIL_EVIDENCE',
  OUT_OF_SCOPE: 'NON_GUANGDONG',
  SOURCE_LOST: 'SOURCE_URL_MISSING_OR_INVALID',
  UNKNOWN_TIME: 'PUBLISHED_TIME_MISSING_OR_SUSPICIOUS',
} satisfies Record<PublicOpportunityAuditDowngradeStatus, string>;

const REPAIR_BATCH_SIZE = 500;

type RepairCandidateRow = AuditPreviewRow & {
  detailJson?: null | string;
};

export interface PublicOpportunityRepairOptions {
  dryRun?: boolean;
  limit?: number;
}

export interface PublicOpportunityRepairResult {
  after: PublicOpportunityAuditCounts;
  auditMode: 'APPLY' | 'DRY_RUN';
  before: PublicOpportunityAuditCounts;
  downgradedCount: number;
  dryRun: boolean;
  generatedAt: string;
  limit: number;
  plannedDowngradeCount: number;
  previewItems: ReturnType<typeof normalizePreviewItem>[];
  reasonCounts: Record<PublicOpportunityAuditDowngradeStatus, number>;
  repairedCount: number;
  scannedCount: number;
}

function normalizeLimit(value: null | number | string | undefined) {
  const normalized = Number(value || AUDIT_PREVIEW_LIMIT);
  if (!Number.isFinite(normalized)) {
    return AUDIT_PREVIEW_LIMIT;
  }
  return Math.max(1, Math.min(500, Math.trunc(normalized)));
}

function buildReasonCountsFromStats(stats: PublicOpportunityAuditCounts) {
  return {
    INVALID: stats.invalidCount,
    OUT_OF_SCOPE: stats.outOfScopeCount,
    SOURCE_LOST: stats.sourceLostCount,
    UNKNOWN_TIME: stats.unknownTimeCount,
  } satisfies Record<PublicOpportunityAuditDowngradeStatus, number>;
}

function parseDetailJson(value: null | string | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function buildRepairDetailJson(
  row: RepairCandidateRow,
  status: PublicOpportunityAuditDowngradeStatus,
) {
  return JSON.stringify({
    ...parseDetailJson(row.detailJson),
    repairAudit: {
      reasonCode: REPAIR_REASON_CODES[status],
      repairedAt: new Date().toISOString(),
      source: 'public-opportunity-repair-service',
      status,
    },
  });
}

async function getRepairStats() {
  const auditScopeSql = buildAuditScopeSql();
  const auditScopeParams = buildAuditScopeParams();
  const rows = await prismaClient.$queryRawUnsafe<AuditCountRow[]>(
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
  );

  return normalizeCounts(rows[0] || {});
}

async function getRepairCandidates(limit: number) {
  const auditScopeSql = buildAuditScopeSql();
  const auditScopeParams = buildAuditScopeParams();

  return prismaClient.$queryRawUnsafe<RepairCandidateRow[]>(
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
        opo.detail_json AS detailJson,
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
      INNER JOIN investment_public_opportunity opo
        ON opo.opportunity_id = audit_scope.opportunityId
      WHERE proposedDowngradeStatus IS NOT NULL
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
    limit,
  );
}

async function repairCandidate(row: RepairCandidateRow) {
  const opportunityId = toCount(row.opportunityId);
  const status = normalizeDowngradeStatus(row.proposedDowngradeStatus);

  if (!opportunityId || !status) {
    return false;
  }

  const affectedRows = await prismaClient.$executeRawUnsafe(
    `
      UPDATE investment_public_opportunity
      SET
        opportunity_status = ?,
        detail_json = ?,
        update_time = NOW(3)
      WHERE opportunity_id = ?
        AND opportunity_status IN ('EFFECTIVE', 'VERIFIED')
    `,
    status,
    buildRepairDetailJson(row, status),
    opportunityId,
  );

  return Number(affectedRows || 0) > 0;
}

export async function repairPublicOpportunityHistory(
  options: PublicOpportunityRepairOptions = {},
): Promise<PublicOpportunityRepairResult> {
  await ensurePublicOpportunityStorage();

  const dryRun = options.dryRun !== false;
  const limit = normalizeLimit(options.limit);
  const before = await getRepairStats();
  const previewCandidates = await getRepairCandidates(limit);
  const reasonCounts = buildReasonCountsFromStats(before);
  let repairedCount = 0;

  if (!dryRun) {
    let batch = await getRepairCandidates(REPAIR_BATCH_SIZE);

    while (batch.length > 0) {
      for (const row of batch) {
        if (await repairCandidate(row)) {
          repairedCount += 1;
        }
      }

      batch = await getRepairCandidates(REPAIR_BATCH_SIZE);
    }
  }

  const after = dryRun ? before : await getRepairStats();

  return {
    after,
    auditMode: dryRun ? 'DRY_RUN' : 'APPLY',
    before,
    downgradedCount: repairedCount,
    dryRun,
    generatedAt: new Date().toISOString(),
    limit,
    plannedDowngradeCount: before.proposedDowngradeCount,
    previewItems: previewCandidates.map((row) => normalizePreviewItem(row)),
    reasonCounts,
    repairedCount,
    scannedCount: dryRun ? before.proposedDowngradeCount : repairedCount,
  };
}

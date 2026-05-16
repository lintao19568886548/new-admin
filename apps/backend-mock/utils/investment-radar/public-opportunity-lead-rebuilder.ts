import type {
  PublicOpportunityLeadSkipReason,
  PublicOpportunityRow,
} from './public-opportunity-lead-policy';

import { prismaClient } from '~/utils/db';

import {
  ExternalLeadValidationError,
  upsertExternalLeadFromCrawler,
} from './external-lead-repository';
import { buildExternalLeadInputFromPublicOpportunityRow } from './public-opportunity-lead-policy';

export type {
  PublicOpportunityLeadSkipReason,
  PublicOpportunityRow,
} from './public-opportunity-lead-policy';

export interface PublicOpportunityLeadRebuildResult {
  createdLeadCount: number;
  evidenceCreatedCount: number;
  matchedCount: number;
  sampleEvidenceIds: number[];
  sampleLeadIds: number[];
  scannedCount: number;
  skippedCount: number;
  skipReasons: Record<PublicOpportunityLeadSkipReason, number>;
  updatedLeadCount: number;
}

function pushSample(target: number[], values: number[]) {
  for (const value of values) {
    if (target.length >= 10) {
      return;
    }
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

function addSkipReason(
  skipReasons: Record<PublicOpportunityLeadSkipReason, number>,
  reason: PublicOpportunityLeadSkipReason,
) {
  skipReasons[reason] += 1;
}

export { buildExternalLeadInputFromPublicOpportunityRow };

export async function rebuildExternalLeadsFromPublicOpportunity(): Promise<PublicOpportunityLeadRebuildResult> {
  const rows = await prismaClient.$queryRawUnsafe<PublicOpportunityRow[]>(`
    SELECT
      opportunity_id AS opportunityId,
      opportunity_type AS opportunityType,
      source_site AS sourceSite,
      source_url AS sourceUrl,
      title,
      city,
      district,
      area_text AS areaText,
      area_sqm AS areaSqm,
      industry_text AS industryText,
      contact_name AS contactName,
      phone_number AS phoneNumber,
      description,
      published_at AS publishedAt,
      tags_json AS tagsJson,
      detail_json AS detailJson,
      last_synced_at AS lastSyncedAt
    FROM investment_public_opportunity
    ORDER BY opportunity_id ASC
  `);

  const skipReasons: Record<PublicOpportunityLeadSkipReason, number> = {
    EXCLUDED_KEYWORD: 0,
    LOW_CONFIDENCE: 0,
    MISSING_SOURCE_URL: 0,
    NO_INCLUDE_KEYWORD: 0,
    NO_RELIABLE_COMPANY_NAME: 0,
    NOT_DEMAND: 0,
  };
  const sampleLeadIds: number[] = [];
  const sampleEvidenceIds: number[] = [];
  let createdLeadCount = 0;
  let evidenceCreatedCount = 0;
  let matchedCount = 0;
  let updatedLeadCount = 0;

  for (const row of rows) {
    const buildResult = buildExternalLeadInputFromPublicOpportunityRow(row);
    if (buildResult.skipReason) {
      addSkipReason(skipReasons, buildResult.skipReason);
      continue;
    }

    matchedCount += 1;
    let result: Awaited<ReturnType<typeof upsertExternalLeadFromCrawler>>;
    try {
      result = await upsertExternalLeadFromCrawler(buildResult.input);
    } catch (error) {
      if (error instanceof ExternalLeadValidationError) {
        matchedCount -= 1;
        addSkipReason(skipReasons, 'LOW_CONFIDENCE');
        continue;
      }
      throw error;
    }

    if (result.created) {
      createdLeadCount += 1;
    }
    if (result.updated) {
      updatedLeadCount += 1;
    }
    evidenceCreatedCount += result.evidenceCreatedCount;
    pushSample(sampleLeadIds, [result.leadId]);
    pushSample(sampleEvidenceIds, result.evidenceIds);
  }

  const skippedCount = Object.values(skipReasons).reduce(
    (sum, count) => sum + count,
    0,
  );
  return {
    createdLeadCount,
    evidenceCreatedCount,
    matchedCount,
    sampleEvidenceIds,
    sampleLeadIds,
    scannedCount: rows.length,
    skippedCount,
    skipReasons,
    updatedLeadCount,
  };
}

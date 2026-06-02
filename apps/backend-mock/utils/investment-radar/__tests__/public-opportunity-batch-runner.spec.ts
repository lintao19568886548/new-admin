import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildPublicOpportunityBatchTotals,
  isEffectiveBatchPayload,
} from '../public-opportunity-batch-policy';

type PublicOpportunityBatchPlatformResult = Parameters<
  typeof buildPublicOpportunityBatchTotals
>[0][number] & {
  failedReasonTop5: Array<{ count: number; reason: string }>;
  opportunityType: 'DEMAND' | 'SUPPLY';
  sourceCode: string;
  sourceName?: null | string;
};

function buildPlatformResult(
  item: Partial<PublicOpportunityBatchPlatformResult>,
): PublicOpportunityBatchPlatformResult {
  return {
    collectedEffectiveCount: 0,
    discoveredUrlCount: 0,
    effectiveCount: 0,
    failedReasonTop5: [],
    fetchedCount: 0,
    fetchSuccessCount: 0,
    opportunityType: 'DEMAND',
    skippedCount: 0,
    sourceCode: 'PUBLIC_DEMAND_TEST',
    status: 'SUCCESS',
    taskId: 1,
    upsertedCount: 0,
    yieldedEffective: false,
    zeroOutput: false,
    ...item,
  };
}

describe('public opportunity batch runner policy', () => {
  it('counts batch task output as effective only for EFFECTIVE quality status', () => {
    expect(
      isEffectiveBatchPayload({
        qualityResult: { status: 'EFFECTIVE' },
      }),
    ).toBe(true);
    expect(
      isEffectiveBatchPayload({
        qualityResult: JSON.stringify({ status: 'EFFECTIVE' }),
      }),
    ).toBe(true);
    expect(
      isEffectiveBatchPayload({
        opportunityStatus: 'EFFECTIVE',
      }),
    ).toBe(true);

    expect(
      isEffectiveBatchPayload({
        qualityResult: { status: 'VERIFIED' },
      }),
    ).toBe(false);
    expect(
      isEffectiveBatchPayload({
        opportunityStatus: 'VERIFIED',
      }),
    ).toBe(false);
    expect(
      isEffectiveBatchPayload({
        qualityResult: { status: 'NEEDS_REVIEW' },
      }),
    ).toBe(false);
  });

  it('separates successful runs from platforms that yielded boss-counted EFFECTIVE rows', () => {
    const totals = buildPublicOpportunityBatchTotals([
      buildPlatformResult({
        collectedEffectiveCount: 10,
        discoveredUrlCount: 20,
        effectiveCount: 2,
        fetchedCount: 12,
        fetchSuccessCount: 11,
        skippedCount: 1,
        upsertedCount: 3,
        yieldedEffective: true,
      }),
      buildPlatformResult({
        collectedEffectiveCount: 5,
        discoveredUrlCount: 0,
        effectiveCount: 0,
        fetchedCount: 0,
        sourceCode: 'PUBLIC_DEMAND_EMPTY',
        taskId: 2,
        zeroOutput: true,
      }),
      buildPlatformResult({
        sourceCode: 'PUBLIC_DEMAND_FAILED',
        status: 'FAILED',
        taskId: null,
        zeroOutput: true,
      }),
    ]);

    expect(totals.collectedEffectiveCount).toBe(15);
    expect(totals.effectiveCount).toBe(2);
    expect(totals.platformCount).toBe(3);
    expect(totals.successPlatformCount).toBe(2);
    expect(totals.failedPlatformCount).toBe(1);
    expect(totals.productivePlatformCount).toBe(1);
    expect(totals.zeroOutputPlatformCount).toBe(2);
    expect(totals.taskCount).toBe(2);
    expect(totals.hasEffectiveOutput).toBe(true);
    expect(totals.hasUsefulOutput).toBe(true);
    expect(totals.onlyZeroOutput).toBe(false);
  });

  it('marks all-zero batch runs so they cannot be mistaken for progress', () => {
    const totals = buildPublicOpportunityBatchTotals([
      buildPlatformResult({
        sourceCode: 'PUBLIC_DEMAND_EMPTY',
        taskId: 10,
        zeroOutput: true,
      }),
      buildPlatformResult({
        sourceCode: 'PUBLIC_SUPPLY_EMPTY',
        taskId: 11,
        zeroOutput: true,
      }),
    ]);

    expect(totals.effectiveCount).toBe(0);
    expect(totals.discoveredUrlCount).toBe(0);
    expect(totals.fetchedCount).toBe(0);
    expect(totals.hasEffectiveOutput).toBe(false);
    expect(totals.hasUsefulOutput).toBe(false);
    expect(totals.onlyZeroOutput).toBe(true);
  });

  it('does not count manual supply rows as collected effective without strict detail evidence', () => {
    const source = readFileSync(
      resolve(__dirname, '../public-opportunity-batch-runner.ts'),
      'utf8',
    );

    expect(source).toContain('STRICT_DETAIL_PAGE_LABELS_ONLY');
    expect(source).toContain("JSON_EXTRACT(opo.detail_json, '$.responseHash')");
    expect(source).not.toContain("OR opo.source_site = 'manual'");
  });

  it('uses the same boss collected policy for collected effective batch totals', () => {
    const source = readFileSync(
      resolve(__dirname, '../public-opportunity-batch-runner.ts'),
      'utf8',
    );

    expect(source).toContain('buildDisplayableCollectedOpportunityWhereSql');
    expect(source).toContain("buildAuditScopeSql(['EFFECTIVE', 'VERIFIED'])");
    expect(source).toContain('...buildAuditScopeParams()');
    expect(source).toContain('LEFT JOIN (');
  });
});

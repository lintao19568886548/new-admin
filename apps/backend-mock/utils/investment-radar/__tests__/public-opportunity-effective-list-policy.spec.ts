import { describe, expect, it } from 'vitest';

import { FUTURE_PUBLISHED_TOLERANCE_DAYS } from '../public-opportunity-audit-rules';
import {
  buildDisplayableCollectedOpportunityWhereSql,
  buildRecentPublishedAtSql,
  buildStrictEffectiveOpportunityListWhereParams,
  buildStrictEffectiveOpportunityListWhereSql,
  buildStrictMaterializedEffectiveOpportunityWhereParams,
  buildStrictMaterializedEffectiveOpportunityWhereSql,
  normalizePublicOpportunityListScope,
} from '../public-opportunity-effective-list-policy';

describe('public opportunity effective list policy', () => {
  it('uses a 180-day freshness window for boss-facing public data', () => {
    expect(buildRecentPublishedAtSql()).toBe(
      'opo.published_at >= DATE_SUB(NOW(3), INTERVAL 180 DAY)',
    );
    expect(buildRecentPublishedAtSql('public_row')).toBe(
      'public_row.published_at >= DATE_SUB(NOW(3), INTERVAL 180 DAY)',
    );
  });

  it('defaults boss-facing public opportunity lists to strict scope', () => {
    expect(normalizePublicOpportunityListScope(undefined)).toBe('strict');
    expect(normalizePublicOpportunityListScope('')).toBe('strict');
    expect(normalizePublicOpportunityListScope('unknown')).toBe('strict');
    expect(normalizePublicOpportunityListScope(' collected ')).toBe(
      'collected',
    );
    expect(normalizePublicOpportunityListScope('REVIEWABLE')).toBe(
      'reviewable',
    );
  });

  it('keeps collected boss-facing rows limited to usable public opportunities', () => {
    const sql = buildDisplayableCollectedOpportunityWhereSql();

    expect(sql).toContain(
      "opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')",
    );
    expect(sql).toContain("opo.quality_grade IN ('EFFECTIVE', 'VERIFIED')");
    expect(sql).toContain('opo.is_guangdong = 1');
    expect(sql).toContain('opo.has_detail_evidence = 1');
    expect(sql).toContain(
      'opo.published_at >= DATE_SUB(NOW(3), INTERVAL 180 DAY)',
    );
    expect(sql).toContain('audit_scope.opportunityId IS NOT NULL');
    expect(sql).toContain('audit_scope.isGuangdong = 1');
    expect(sql).toContain('opo.quality_grade IS NULL');
    expect(sql).toContain('audit_scope.missingCity = 0');
    expect(sql).toContain('audit_scope.missingSourceUrl = 0');
    expect(sql).toContain('audit_scope.missingPublishedAt = 0');
    expect(sql).toContain('audit_scope.suspiciousPublishedAt = 0');
    expect(sql).toContain('audit_scope.missingSupplyLocation = 0');
    expect(sql).toContain('audit_scope.missingHashOrDetailEvidence = 0');
    expect(sql).not.toContain('crawler_task_item');
  });

  it('supports explicit aliases for composed SQL without changing status policy', () => {
    const sql = buildDisplayableCollectedOpportunityWhereSql(
      'public_row',
      'audit_row',
    );

    expect(sql).toContain(
      "public_row.opportunity_status IN ('EFFECTIVE', 'VERIFIED')",
    );
    expect(sql).toContain(
      "public_row.quality_grade IN ('EFFECTIVE', 'VERIFIED')",
    );
    expect(sql).toContain('public_row.is_guangdong = 1');
    expect(sql).toContain('public_row.has_detail_evidence = 1');
    expect(sql).toContain(
      'public_row.published_at >= DATE_SUB(NOW(3), INTERVAL 180 DAY)',
    );
    expect(sql).toContain('audit_row.isGuangdong = 1');
  });

  it('keeps strict materialized boss-facing rows limited to usable public opportunities', () => {
    const sql = buildStrictMaterializedEffectiveOpportunityWhereSql();

    expect(sql).toContain(
      "opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')",
    );
    expect(sql).toContain("opo.quality_grade IN ('EFFECTIVE', 'VERIFIED')");
    expect(sql).toContain('opo.is_guangdong = 1');
    expect(sql).toContain('opo.has_detail_evidence = 1');
    expect(sql).toContain('LOWER(TRIM(opo.source_url)) REGEXP ?');
    expect(sql).toContain(
      'opo.published_at >= DATE_SUB(NOW(3), INTERVAL 180 DAY)',
    );
    expect(sql).toContain(
      'COALESCE(opo.last_synced_at, opo.update_time, opo.create_time)',
    );
    expect(sql).not.toContain('DATE_ADD(\n            opo.create_time');
    expect(buildStrictMaterializedEffectiveOpportunityWhereParams()).toEqual([
      '^https?://',
      FUTURE_PUBLISHED_TOLERANCE_DAYS,
      '2000-01-01 00:00:00',
      7,
    ]);
    expect(sql).not.toContain('crawler_task_item');
  });

  it('keeps strict list SQL on materialized fast path with legacy fallback', () => {
    const sql = buildStrictEffectiveOpportunityListWhereSql();

    expect(sql).toContain("opo.quality_grade IN ('EFFECTIVE', 'VERIFIED')");
    expect(sql).toContain('opo.is_guangdong = 1');
    expect(sql).toContain('opo.has_detail_evidence = 1');
    expect(sql).toContain('opo.quality_grade IS NULL');
    expect(sql).toContain('opo.detail_json REGEXP ?');
    expect(sql).not.toContain('crawler_task_item');
    expect(buildStrictEffectiveOpportunityListWhereParams()).toHaveLength(12);
  });
});

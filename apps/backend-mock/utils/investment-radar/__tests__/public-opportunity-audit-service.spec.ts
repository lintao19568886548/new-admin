import { describe, expect, it } from 'vitest';

import { buildAuditScopeSql } from '../public-opportunity-audit-rules';
import {
  buildDashboardEffectiveSql,
  buildMaterializedDashboardEffectiveSql,
} from '../public-opportunity-dashboard-policy';

describe('public opportunity audit service dashboard policy', () => {
  it('keeps boss-facing dashboard effective rows limited to usable public opportunities', () => {
    const sql = buildDashboardEffectiveSql(
      buildAuditScopeSql(['EFFECTIVE', 'VERIFIED']),
    );

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
    expect(sql).toContain('audit_scope.missingHashOrDetailEvidence = 0');
    expect(sql).toContain("opportunity_status IN ('EFFECTIVE', 'VERIFIED')");
    expect(sql).not.toContain('crawler_task_item');
    expect(sql).not.toContain("OR opo.source_site = 'manual'");
  });

  it('uses materialized fields for the audit summary dashboard fast path', () => {
    const sql = buildMaterializedDashboardEffectiveSql();

    expect(sql).toContain(
      "opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')",
    );
    expect(sql).toContain("opo.quality_grade IN ('EFFECTIVE', 'VERIFIED')");
    expect(sql).toContain('opo.is_guangdong = 1');
    expect(sql).toContain('opo.has_detail_evidence = 1');
    expect(sql).toContain(
      'opo.published_at >= DATE_SUB(NOW(3), INTERVAL 180 DAY)',
    );
    expect(sql).toContain('AS sourceCode');
    expect(sql).not.toContain('audit_scope');
    expect(sql).not.toContain('crawler_task_item');
    expect(sql).not.toContain('dedupeRank');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('public opportunity effective list service SQL', () => {
  it('keeps collected list audit fallback optional for effective records', () => {
    const source = readFileSync(
      resolve(__dirname, '../public-opportunity-effective-list-service.ts'),
      'utf8',
    );

    expect(source).toContain('LEFT JOIN (');
    expect(source).toContain("buildAuditScopeSql(['EFFECTIVE', 'VERIFIED'])");
  });

  it('uses strict materialized list policy for default and typed strict queries', () => {
    const source = readFileSync(
      resolve(__dirname, '../public-opportunity-effective-list-service.ts'),
      'utf8',
    );

    expect(source).toContain('buildStrictEffectiveOpportunityListWhereSql');
    expect(source).toContain('buildStrictEffectiveOpportunityListWhereParams');
    expect(source).toContain("'opo.opportunity_type = ?'");
    expect(source).not.toContain(
      'buildStrictDemandEffectiveOpportunityWhereSql',
    );
  });

  it('does not let manual supply rows bypass strict detail evidence', () => {
    const source = readFileSync(
      resolve(__dirname, '../public-opportunity-effective-list-service.ts'),
      'utf8',
    );

    expect(source).toContain("extractionPolicy'))");
    expect(source).toContain('STRICT_DETAIL_PAGE_LABELS_ONLY');
    expect(source).toContain("responseHash'))");
    expect(source).not.toContain("OR opo.source_site = 'manual'");
  });

  it('keeps published-age filters sargable for the published_at index', () => {
    const source = readFileSync(
      resolve(__dirname, '../public-opportunity-effective-list-service.ts'),
      'utf8',
    );

    expect(source).toContain('DATE_SUB(NOW(3), INTERVAL ? HOUR)');
    expect(source).toContain('DATE_SUB(NOW(3), INTERVAL ? DAY)');
    expect(source).not.toContain(
      'TIMESTAMPDIFF(HOUR, opo.published_at, NOW()) = ?',
    );
    expect(source).not.toContain(
      'TIMESTAMPDIFF(DAY, opo.published_at, NOW()) = ?',
    );
  });

  it('can skip authoritative totals for first-paint list requests', () => {
    const source = readFileSync(
      resolve(__dirname, '../public-opportunity-effective-list-service.ts'),
      'utf8',
    );

    expect(source).toContain('if (!params.includeMeta) {');
    expect(source).toContain('if (!params.includeTotal) {');
    expect(source).toContain('totalKnown: knownTotal !== undefined');
    expect(source).toContain(
      'const total = await countEffectivePublicOpportunities(scopedQuery);',
    );
    expect(source).not.toContain('total: items.length');
  });
});

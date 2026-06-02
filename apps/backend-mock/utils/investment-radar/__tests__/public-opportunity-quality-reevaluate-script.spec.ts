import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('public opportunity quality reevaluate script', () => {
  it('backfills materialized quality fields while reevaluating historical rows', () => {
    const source = readFileSync(
      resolve(
        __dirname,
        '../../../scripts/reevaluate-public-opportunity-quality.ts',
      ),
      'utf8',
    );

    expect(source).toContain('buildPublicOpportunityMaterializedFields');
    expect(source).toContain('source_code AS sourceCode');
    expect(source).toContain('is_guangdong AS isGuangdong');
    expect(source).toContain('has_detail_evidence AS hasDetailEvidence');
    expect(source).toContain('quality_grade AS qualityGrade');
    expect(source).toContain('source_code = ?');
    expect(source).toContain('is_guangdong = ?');
    expect(source).toContain('has_detail_evidence = ?');
    expect(source).toContain('quality_grade = ?');
  });
});

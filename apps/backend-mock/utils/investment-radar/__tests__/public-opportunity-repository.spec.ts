import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('public opportunity repository', () => {
  it('materializes manual rows with quality fields so they cannot bypass boss effective policy', () => {
    const source = readFileSync(
      resolve(__dirname, '../public-opportunity-repository.ts'),
      'utf8',
    );

    expect(source).toContain('const manualQualityResult');
    expect(source).toContain('buildPublicOpportunityMaterializedFields({');
    expect(source).toContain('qualityResult: manualQualityResult');
    expect(source).toContain('source_code = ?');
    expect(source).toContain('is_guangdong = ?');
    expect(source).toContain('has_detail_evidence = ?');
    expect(source).toContain('quality_grade = ?');
    expect(source).toContain(
      'published_date_text, opportunity_status, source_code, is_guangdong,',
    );
  });

  it('keeps crawler upsert matching scoped by opportunity type', () => {
    const source = readFileSync(
      resolve(__dirname, '../public-opportunity-repository.ts'),
      'utf8',
    );

    expect(source).toContain(
      'WHERE (opportunity_type = ? AND source_table = ? AND source_key = ?)',
    );
    expect(source).toContain(
      'WHERE opportunity_type = ? AND source_table = ? AND source_key = ?',
    );
  });
});

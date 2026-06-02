import { describe, expect, it } from 'vitest';

import {
  buildPublicOpportunityMaterializedFields,
  resolvePublicOpportunitySourceCode,
} from '../public-opportunity-materialized-fields';
import { buildResponseHash } from '../public-opportunity-quality';

describe('public opportunity materialized fields', () => {
  it('prefers crawler source code from detail json', () => {
    expect(
      resolvePublicOpportunitySourceCode({
        detailJson: { crawlerSourceCode: 'PUBLIC_DEMAND_99CFW_GD' },
        opportunityType: 'DEMAND',
        sourceSite: '99cfw',
        tagsJson: ['PUBLIC_DEMAND_CFZX_GD'],
      }),
    ).toBe('PUBLIC_DEMAND_99CFW_GD');
  });

  it('falls back to public source code tags', () => {
    expect(
      resolvePublicOpportunitySourceCode({
        detailJson: {},
        opportunityType: 'SUPPLY',
        sourceSite: 'unknown',
        tagsJson: ['crawler', 'PUBLIC_FACTORY_LISTING_TOODC_GD'],
      }),
    ).toBe('PUBLIC_FACTORY_LISTING_TOODC_GD');
  });

  it('falls back to source site mapping when detail and tags are missing', () => {
    expect(
      resolvePublicOpportunitySourceCode({
        detailJson: {},
        opportunityType: 'SUPPLY',
        sourceSite: 'cfzsw68.com',
        tagsJson: [],
      }),
    ).toBe('PUBLIC_FACTORY_LISTING_CFZSW68');
  });

  it('materializes guangdong, detail evidence, and quality grade from quality result', () => {
    expect(
      buildPublicOpportunityMaterializedFields({
        detailJson: { responseHash: buildResponseHash('html') },
        opportunityType: 'DEMAND',
        qualityResult: {
          city: '东莞',
          missingFields: [],
          reasons: [],
          status: 'EFFECTIVE',
        },
        sourceSite: '99cfw',
        tagsJson: [],
      }),
    ).toMatchObject({
      hasDetailEvidence: true,
      isGuangdong: true,
      qualityGrade: 'EFFECTIVE',
      sourceCode: 'PUBLIC_DEMAND_99CFW_GD',
    });
  });

  it('keeps out-of-scope rows out of materialized guangdong flag', () => {
    expect(
      buildPublicOpportunityMaterializedFields({
        detailJson: { responseHash: buildResponseHash('html') },
        opportunityType: 'DEMAND',
        qualityResult: {
          city: '东莞',
          missingFields: [],
          reasons: ['CITY_OUT_OF_GUANGDONG_SCOPE'],
          status: 'OUT_OF_SCOPE',
        },
        sourceSite: '99cfw',
        tagsJson: [],
      }),
    ).toMatchObject({
      hasDetailEvidence: true,
      isGuangdong: false,
      qualityGrade: 'OUT_OF_SCOPE',
    });
  });
});

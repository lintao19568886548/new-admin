import { describe, expect, it } from 'vitest';

import { serializePublicOpportunityRow } from '../public-opportunity-serializer';

describe('public opportunity serializer', () => {
  it('serializes materialized quality fields without leaking numeric flags', () => {
    expect(
      serializePublicOpportunityRow({
        hasDetailEvidence: 1,
        isGuangdong: '1',
        opportunityId: BigInt(101),
        opportunityStatus: 'EFFECTIVE',
        opportunityType: 'DEMAND',
        qualityGrade: 'EFFECTIVE',
        sourceCode: 'PUBLIC_DEMAND_99CFW_GD',
        sourceUrl: 'https://www.99cfw.com/changfangxuqiu/101.html',
      }),
    ).toMatchObject({
      hasDetailEvidence: true,
      isGuangdong: true,
      opportunityId: 101,
      qualityGrade: 'EFFECTIVE',
      sourceCode: 'PUBLIC_DEMAND_99CFW_GD',
    });
  });
});

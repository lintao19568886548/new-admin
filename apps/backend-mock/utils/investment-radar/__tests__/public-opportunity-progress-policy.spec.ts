import { describe, expect, it } from 'vitest';

import {
  GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES,
  PUBLIC_DEMAND_PLATFORM_SOURCE_CODES,
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  PUBLIC_FACTORY_LISTING_PLATFORM_SOURCE_CODES,
  PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
} from '../crawler-types';
import {
  getPublicOpportunityProgressSourceCodes,
  normalizePublicOpportunityProgressType,
} from '../public-opportunity-progress-policy';

describe('public opportunity progress policy', () => {
  it('normalizes progress type to demand, supply, or all sources', () => {
    expect(normalizePublicOpportunityProgressType(' demand ')).toBe('DEMAND');
    expect(normalizePublicOpportunityProgressType('SUPPLY')).toBe('SUPPLY');
    expect(normalizePublicOpportunityProgressType('unknown')).toBe('');
  });

  it('keeps demand progress limited to public demand crawler sources', () => {
    const sourceCodes = getPublicOpportunityProgressSourceCodes('DEMAND');

    expect(sourceCodes).toContain(PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE);
    for (const sourceCode of PUBLIC_DEMAND_PLATFORM_SOURCE_CODES) {
      expect(sourceCodes).toContain(sourceCode);
    }
    expect(sourceCodes).not.toContain(
      PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
    );
  });

  it('includes both generic and province-wide listing sources for supply progress', () => {
    const sourceCodes = getPublicOpportunityProgressSourceCodes('SUPPLY');

    expect(sourceCodes).toContain(PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE);
    for (const sourceCode of GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES) {
      expect(sourceCodes).toContain(sourceCode);
    }
    for (const sourceCode of PUBLIC_FACTORY_LISTING_PLATFORM_SOURCE_CODES) {
      expect(sourceCodes).toContain(sourceCode);
    }
    expect(sourceCodes).not.toContain(PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE);
  });

  it('returns all public demand and listing sources when no type is selected', () => {
    const sourceCodes = getPublicOpportunityProgressSourceCodes('');

    expect(sourceCodes).toContain(PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE);
    expect(sourceCodes).toContain(PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE);
    expect(sourceCodes).toEqual(
      expect.arrayContaining([
        ...PUBLIC_DEMAND_PLATFORM_SOURCE_CODES,
        ...GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES,
        ...PUBLIC_FACTORY_LISTING_PLATFORM_SOURCE_CODES,
      ]),
    );
  });
});

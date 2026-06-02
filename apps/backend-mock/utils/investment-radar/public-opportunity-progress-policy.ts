import {
  GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES,
  PUBLIC_DEMAND_PLATFORM_SOURCE_CODES,
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  PUBLIC_FACTORY_LISTING_PLATFORM_SOURCE_CODES,
  PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
} from './crawler-types';

export type PublicOpportunityProgressType = '' | 'DEMAND' | 'SUPPLY';

export function normalizePublicOpportunityProgressType(
  value: unknown,
): PublicOpportunityProgressType {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  return normalized === 'SUPPLY' || normalized === 'DEMAND' ? normalized : '';
}

export function getPublicOpportunityProgressSourceCodes(
  opportunityType: unknown,
) {
  const normalizedType =
    normalizePublicOpportunityProgressType(opportunityType);
  const demandSourceCodes = [
    PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
    ...PUBLIC_DEMAND_PLATFORM_SOURCE_CODES,
  ];
  const supplySourceCodes = [
    PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
    ...GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES,
    ...PUBLIC_FACTORY_LISTING_PLATFORM_SOURCE_CODES,
  ];

  if (normalizedType === 'DEMAND') {
    return demandSourceCodes;
  }
  if (normalizedType === 'SUPPLY') {
    return supplySourceCodes;
  }
  return [...demandSourceCodes, ...supplySourceCodes];
}

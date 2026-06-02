import type { PublicOpportunityQualityResult } from './public-opportunity-quality';

import {
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES,
} from './crawler-types';
import { hasDetailEvidence } from './public-opportunity-quality';

type PublicOpportunityType = 'DEMAND' | 'SUPPLY' | string;

export interface PublicOpportunityMaterializedFieldInput {
  detailJson?: null | Record<string, unknown>;
  opportunityType?: null | PublicOpportunityType;
  qualityResult: PublicOpportunityQualityResult;
  sourceSite?: null | string;
  tagsJson?: unknown;
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }
  if (typeof value !== 'string') {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => normalizeString(item)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function resolvePublicOpportunitySourceCode(
  input: Omit<PublicOpportunityMaterializedFieldInput, 'qualityResult'>,
) {
  const detailJson = input.detailJson || {};
  const detailSourceCode =
    normalizeString(detailJson.crawlerSourceCode) ||
    normalizeString(detailJson.sourceCode);
  if (detailSourceCode) {
    return detailSourceCode.slice(0, 80);
  }

  const tags = normalizeTags(input.tagsJson);
  const taggedSourceCode = tags.find((tag) =>
    PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.includes(tag as any),
  );
  if (taggedSourceCode) {
    return taggedSourceCode.slice(0, 80);
  }

  const opportunityType = normalizeString(input.opportunityType).toUpperCase();
  const sourceSite = normalizeString(input.sourceSite).toLowerCase();
  if (opportunityType === 'DEMAND' && sourceSite === '99cfw') {
    return 'PUBLIC_DEMAND_99CFW_GD';
  }
  if (opportunityType === 'SUPPLY' && sourceSite === 'cfzsw68.com') {
    return PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE;
  }
  if (opportunityType === 'SUPPLY' && sourceSite === '99cfw') {
    return 'PUBLIC_FACTORY_LISTING_99CFW_GD';
  }
  if (opportunityType === 'SUPPLY' && sourceSite === 'fang.com') {
    return 'PUBLIC_FACTORY_LISTING_FANG_GD';
  }
  if (opportunityType === 'SUPPLY' && sourceSite === 'szaqfdc.com') {
    return 'PUBLIC_FACTORY_LISTING_SZAQFDC_DG';
  }
  if (opportunityType === 'SUPPLY' && sourceSite === 'toodc.cn') {
    return 'PUBLIC_FACTORY_LISTING_TOODC_GD';
  }
  if (opportunityType === 'SUPPLY' && sourceSite === 'digitalgd.com.cn') {
    return 'PUBLIC_FACTORY_LISTING_TZGD_GD';
  }
  if (opportunityType === 'SUPPLY' && sourceSite === 'ttchangfang.com') {
    return 'PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD';
  }
  if (opportunityType === 'SUPPLY' && sourceSite === 'gdcfzs.com') {
    return 'PUBLIC_FACTORY_LISTING_GDCFZS_GD';
  }
  if (opportunityType === 'SUPPLY' && sourceSite === 'szcfw.com') {
    return 'PUBLIC_FACTORY_LISTING_SZCFW_GD';
  }
  if (opportunityType === 'SUPPLY' && sourceSite === 'szkkw.com') {
    return 'PUBLIC_FACTORY_LISTING_SZKKW_GD';
  }
  if (opportunityType === 'SUPPLY' && sourceSite === 'hfdpt.com') {
    return 'PUBLIC_FACTORY_LISTING_HFDPT_GD';
  }
  if (opportunityType === 'SUPPLY' && sourceSite === 'changfang88.com') {
    return 'PUBLIC_FACTORY_LISTING_CHANGFANG88_GD';
  }
  if (opportunityType === 'SUPPLY' && sourceSite === 'ysol.com') {
    return 'PUBLIC_FACTORY_LISTING_YSOL_GD';
  }
  if (opportunityType === 'DEMAND' && sourceSite === 'zhaoshang.net') {
    return 'PUBLIC_DEMAND_ZHAOSHANG_NET_GD';
  }

  return null;
}

export function buildPublicOpportunityMaterializedFields(
  input: PublicOpportunityMaterializedFieldInput,
) {
  const isOutOfGuangdong = input.qualityResult.reasons.some((reason) =>
    ['CITY_OUT_OF_GUANGDONG_SCOPE', 'OUT_OF_GUANGDONG_SCOPE'].includes(reason),
  );

  return {
    hasDetailEvidence: hasDetailEvidence(input.detailJson),
    isGuangdong: Boolean(input.qualityResult.city && !isOutOfGuangdong),
    qualityGrade: input.qualityResult.status,
    sourceCode: resolvePublicOpportunitySourceCode(input),
  };
}

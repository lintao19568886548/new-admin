import { createHash } from 'node:crypto';

import {
  hasExplicitNonGuangdongCity,
  hasExplicitNonGuangdongPlaceSignal,
  hasExplicitNonGuangdongRegion,
  isUnknownCityValue,
  isWithinGuangdongScope,
  normalizeGuangdongCity,
} from './guangdong-public-scope';

const PUBLIC_OPPORTUNITY_MAX_AGE_DAYS = 180;

export type PublicOpportunityQualityStatus =
  | 'EFFECTIVE'
  | 'EXPIRED'
  | 'INVALID'
  | 'NEEDS_REVIEW'
  | 'OUT_OF_SCOPE'
  | 'PARSED'
  | 'RAW'
  | 'SOURCE_LOST'
  | 'UNKNOWN_TIME'
  | 'VERIFIED';

export interface PublicOpportunityQualityInput {
  areaSqm?: null | number;
  areaText?: null | string;
  city?: null | string;
  contactName?: null | string;
  description?: null | string;
  detailJson?: null | Record<string, unknown>;
  district?: null | string;
  opportunityStatus?: null | string;
  opportunityType?: null | string;
  phoneNumber?: null | string;
  priceText?: null | string;
  province?: null | string;
  publishedAt?: Date | null | string;
  publishedDateText?: null | string;
  sourceSite?: null | string;
  sourceUrl?: null | string;
  title?: null | string;
}

export interface PublicOpportunityQualityResult {
  city: null | string;
  missingFields: string[];
  reasons: string[];
  status: PublicOpportunityQualityStatus;
}

function normalizeString(value: null | string | undefined) {
  return String(value || '').trim();
}

function isValidDateParts(params: {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}) {
  if (
    params.month < 1 ||
    params.month > 12 ||
    params.day < 1 ||
    params.day > 31 ||
    params.hour < 0 ||
    params.hour > 23 ||
    params.minute < 0 ||
    params.minute > 59 ||
    params.second < 0 ||
    params.second > 59
  ) {
    return false;
  }
  const date = new Date(
    params.year,
    params.month - 1,
    params.day,
    params.hour,
    params.minute,
    params.second,
  );
  return (
    date.getFullYear() === params.year &&
    date.getMonth() + 1 === params.month &&
    date.getDate() === params.day
  );
}

function hasSourceUrl(value: null | string | undefined) {
  const sourceUrl = normalizeString(value);
  if (!sourceUrl) {
    return false;
  }

  try {
    const url = new URL(sourceUrl);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function buildResponseHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function hasDetailEvidence(
  detailJson: null | Record<string, unknown> | undefined,
) {
  if (!detailJson) {
    return false;
  }

  const responseHash = normalizeString(
    typeof detailJson.responseHash === 'string' ? detailJson.responseHash : '',
  );
  const sourceSnapshotHash = normalizeString(
    typeof detailJson.sourceSnapshotHash === 'string'
      ? detailJson.sourceSnapshotHash
      : '',
  );
  const rawEvidenceText = normalizeString(
    typeof detailJson.rawEvidenceText === 'string'
      ? detailJson.rawEvidenceText
      : '',
  );

  return Boolean(responseHash || sourceSnapshotHash || rawEvidenceText);
}

function getStrictExtractionMissingFields(
  detailJson: null | Record<string, unknown> | undefined,
) {
  const missingFields = detailJson?.missingFields;
  if (!Array.isArray(missingFields)) {
    return [];
  }
  return missingFields
    .map((field) => normalizeString(String(field)))
    .filter(Boolean);
}

const DEMAND_OPTIONAL_STRICT_FIELDS = new Set([
  'contactName',
  'phoneNumber',
  'priceText',
]);

export function parsePublicPublishedAt(
  publishedDateText: null | string | undefined,
  crawledAt: Date = new Date(),
) {
  const text = normalizeString(publishedDateText);
  if (!text) {
    return null;
  }

  const relativeMatch = text.match(/(\d+)\s*(分钟|小时|[天日周月年])前/);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    if (!Number.isFinite(amount)) {
      return null;
    }

    const date = new Date(crawledAt);
    switch (unit) {
      case '分钟': {
        date.setMinutes(date.getMinutes() - amount);

        break;
      }
      case '周': {
        date.setDate(date.getDate() - amount * 7);

        break;
      }
      case '天':
      case '日': {
        date.setDate(date.getDate() - amount);

        break;
      }
      case '小时': {
        date.setHours(date.getHours() - amount);

        break;
      }
      case '年': {
        date.setFullYear(date.getFullYear() - amount);

        break;
      }
      case '月': {
        date.setMonth(date.getMonth() - amount);

        break;
      }
      // No default
    }
    return date;
  }

  const dateTimeMatch = text.match(
    /(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
  );
  if (dateTimeMatch) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] =
      dateTimeMatch;
    const parts = {
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      month: Number(month),
      second: Number(second),
      year: Number(year),
    };
    if (!isValidDateParts(parts)) {
      return null;
    }
    return new Date(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
  }

  const monthDayMatch = text.match(
    /(?:发布于|发布时间[:：]?)?\s*(\d{1,2})[-/.月](\d{1,2})日?(?:\s+(\d{1,2}):(\d{1,2}))?/,
  );
  if (monthDayMatch) {
    const [, month, day, hour = '0', minute = '0'] = monthDayMatch;
    const parts = {
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      month: Number(month),
      second: 0,
      year: crawledAt.getFullYear(),
    };
    if (!isValidDateParts(parts)) {
      return null;
    }
    return new Date(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
  }

  return null;
}

function hasPublishedAt(input: PublicOpportunityQualityInput) {
  if (input.publishedAt) {
    return true;
  }
  return Boolean(parsePublicPublishedAt(input.publishedDateText));
}

function resolvePublishedAtDate(input: PublicOpportunityQualityInput) {
  if (input.publishedAt) {
    const date = new Date(input.publishedAt);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return parsePublicPublishedAt(input.publishedDateText);
}

function isPublishedAtExpired(input: PublicOpportunityQualityInput) {
  const publishedAt = resolvePublishedAtDate(input);
  if (!publishedAt) {
    return false;
  }
  const maxAgeMs = PUBLIC_OPPORTUNITY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return publishedAt.getTime() < Date.now() - maxAgeMs;
}

function hasArea(input: PublicOpportunityQualityInput) {
  return Boolean(input.areaSqm && input.areaSqm > 0) || Boolean(input.areaText);
}

function isSupply(input: PublicOpportunityQualityInput) {
  return input.opportunityType === 'SUPPLY';
}

function collectMissingFields(input: PublicOpportunityQualityInput) {
  const missingFields = new Set<string>(
    getStrictExtractionMissingFields(input.detailJson).filter(
      (field) => isSupply(input) || !DEMAND_OPTIONAL_STRICT_FIELDS.has(field),
    ),
  );
  if (!input.title) {
    missingFields.add('title');
  }
  if (!input.city) {
    missingFields.add('city');
  }
  if (isSupply(input) && !input.district) {
    missingFields.add('district');
  }
  if (!hasSourceUrl(input.sourceUrl)) {
    missingFields.add('sourceUrl');
  }
  if (!hasPublishedAt(input)) {
    missingFields.add('publishedAt');
  }
  if (!hasArea(input)) {
    missingFields.add('area');
  }
  if (isSupply(input) && !input.priceText) {
    missingFields.add('priceText');
  }
  if (isSupply(input) && !input.contactName) {
    missingFields.add('contactName');
  }
  if (isSupply(input) && !input.phoneNumber) {
    missingFields.add('phoneNumber');
  }
  if (!hasDetailEvidence(input.detailJson)) {
    missingFields.add('detailEvidence');
  }
  return [...missingFields];
}

function resolveConfirmedGuangdongCity(input: PublicOpportunityQualityInput) {
  return normalizeGuangdongCity(input.city);
}

function getDetailStringField(
  detailJson: null | Record<string, unknown> | undefined,
  fieldName: string,
) {
  const value = detailJson?.[fieldName];
  return typeof value === 'string' ? value : '';
}

function buildCoreDetailRegionText(input: PublicOpportunityQualityInput) {
  return [
    input.province,
    input.city,
    input.district,
    input.title,
    getDetailStringField(input.detailJson, 'locationEvidenceText'),
    getDetailStringField(input.detailJson, 'primaryContentText'),
  ]
    .filter(Boolean)
    .join(' ');
}

export function evaluatePublicOpportunityQuality(
  input: PublicOpportunityQualityInput,
): PublicOpportunityQualityResult {
  const scopeText = [
    input.province,
    input.city,
    input.district,
    input.title,
    input.sourceSite,
    input.sourceUrl,
  ]
    .filter(Boolean)
    .join(' ');
  const coreRegionText = [
    input.province,
    input.city,
    input.district,
    input.title,
  ]
    .filter(Boolean)
    .join(' ');
  const coreDetailRegionText = buildCoreDetailRegionText(input);
  const city = resolveConfirmedGuangdongCity(input);
  const missingFields = collectMissingFields(input);

  if (hasExplicitNonGuangdongCity(input.city)) {
    return {
      city,
      missingFields,
      reasons: ['CITY_OUT_OF_GUANGDONG_SCOPE'],
      status: 'OUT_OF_SCOPE',
    };
  }

  if (!city) {
    const reason =
      input.city && !isUnknownCityValue(input.city)
        ? 'CITY_OUT_OF_GUANGDONG_SCOPE'
        : 'GUANGDONG_CITY_UNCONFIRMED';
    return {
      city,
      missingFields,
      reasons: [reason],
      status: 'INVALID',
    };
  }

  if (hasExplicitNonGuangdongRegion(coreRegionText)) {
    return {
      city,
      missingFields,
      reasons: ['CITY_OUT_OF_GUANGDONG_SCOPE'],
      status: 'OUT_OF_SCOPE',
    };
  }

  if (hasExplicitNonGuangdongPlaceSignal(coreDetailRegionText)) {
    return {
      city,
      missingFields,
      reasons: ['CITY_OUT_OF_GUANGDONG_SCOPE'],
      status: 'OUT_OF_SCOPE',
    };
  }

  if (!isWithinGuangdongScope({ ...input, text: scopeText })) {
    return {
      city,
      missingFields,
      reasons: ['OUT_OF_GUANGDONG_SCOPE'],
      status: 'OUT_OF_SCOPE',
    };
  }

  if (input.opportunityStatus === 'EXPIRED') {
    return {
      city,
      missingFields,
      reasons: ['SOURCE_EXPIRED'],
      status: 'EXPIRED',
    };
  }

  if (isPublishedAtExpired(input)) {
    return {
      city,
      missingFields,
      reasons: ['PUBLISHED_AT_EXPIRED'],
      status: 'EXPIRED',
    };
  }

  if (input.opportunityType === 'SUPPLY' && !input.district) {
    return {
      city,
      missingFields,
      reasons: ['SUPPLY_LOCATION_MISSING'],
      status: 'INVALID',
    };
  }

  if (!hasSourceUrl(input.sourceUrl)) {
    return {
      city,
      missingFields,
      reasons: ['SOURCE_URL_MISSING_OR_INVALID'],
      status: 'SOURCE_LOST',
    };
  }
  if (!hasPublishedAt(input)) {
    return {
      city,
      missingFields,
      reasons: ['PUBLISHED_AT_MISSING_OR_UNPARSEABLE'],
      status: 'UNKNOWN_TIME',
    };
  }
  if (!hasDetailEvidence(input.detailJson)) {
    return {
      city,
      missingFields,
      reasons: ['DETAIL_EVIDENCE_MISSING'],
      status: 'INVALID',
    };
  }

  if (missingFields.length > 0) {
    return {
      city,
      missingFields,
      reasons: ['KEY_FIELDS_INCOMPLETE'],
      status: 'VERIFIED',
    };
  }

  return {
    city,
    missingFields,
    reasons: [],
    status: 'EFFECTIVE',
  };
}

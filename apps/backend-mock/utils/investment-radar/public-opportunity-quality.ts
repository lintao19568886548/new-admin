import { createHash } from 'node:crypto';

import {
  hasExplicitNonGuangdongCity,
  isUnknownCityValue,
  isWithinGuangdongScope,
  normalizeGuangdongCity,
} from './guangdong-public-scope';

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
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
  }

  const monthDayMatch = text.match(
    /(?:发布于|发布时间[:：]?)?\s*(\d{1,2})[-/.月](\d{1,2})日?(?:\s+(\d{1,2}):(\d{1,2}))?/,
  );
  if (monthDayMatch) {
    const [, month, day, hour = '0', minute = '0'] = monthDayMatch;
    return new Date(
      crawledAt.getFullYear(),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
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

function hasArea(input: PublicOpportunityQualityInput) {
  return Boolean(input.areaSqm && input.areaSqm > 0) || Boolean(input.areaText);
}

function collectMissingFields(input: PublicOpportunityQualityInput) {
  const missingFields = new Set<string>(
    getStrictExtractionMissingFields(input.detailJson),
  );
  if (!input.title) {
    missingFields.add('title');
  }
  if (!input.city) {
    missingFields.add('city');
  }
  if (input.opportunityType === 'SUPPLY' && !input.district) {
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
  if (!input.priceText) {
    missingFields.add('priceText');
  }
  if (!input.contactName) {
    missingFields.add('contactName');
  }
  if (!input.phoneNumber) {
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

export function evaluatePublicOpportunityQuality(
  input: PublicOpportunityQualityInput,
): PublicOpportunityQualityResult {
  const scopeText = [input.title, input.description, input.sourceSite]
    .filter(Boolean)
    .join(' ');
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

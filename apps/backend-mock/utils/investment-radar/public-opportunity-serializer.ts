type PublicOpportunityRawRow = Record<string, unknown>;

function toNullableString(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function toSafeNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : String(value);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'object') {
    const decimalLike = value as {
      toNumber?: () => number;
      toString?: () => string;
    };
    if (typeof decimalLike.toNumber === 'function') {
      const normalized = decimalLike.toNumber();
      return Number.isFinite(normalized) ? normalized : null;
    }
  }
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function toBooleanFlag(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value > 0;
  }
  if (typeof value === 'bigint') {
    return value > 0;
  }
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return ['1', 'on', 'true', 'yes'].includes(normalized);
}

function toNullableIsoString(value: unknown) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
}

function toJsonSafeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : String(value);
  }
  if (value instanceof Date) {
    return toNullableIsoString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafeValue(item));
  }
  if (typeof value === 'object') {
    const decimalLike = value as { toNumber?: () => number };
    if (typeof decimalLike.toNumber === 'function') {
      return toSafeNumber(value);
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        toJsonSafeValue(item),
      ]),
    );
  }
  return value;
}

function parseJsonValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    return toJsonSafeValue(value);
  }
  try {
    return toJsonSafeValue(JSON.parse(value));
  } catch {
    return null;
  }
}

function parseTagsJson(value: unknown) {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map(String)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializePublicOpportunityRow(row: PublicOpportunityRawRow) {
  const opportunityType = toNullableString(row.opportunityType) || 'UNKNOWN';
  return {
    areaSqm: toSafeNumber(row.areaSqm),
    areaText: toNullableString(row.areaText),
    city: toNullableString(row.city),
    contactName: toNullableString(row.contactName),
    description: toNullableString(row.description),
    detailJson: parseJsonValue(row.detailJson),
    district: toNullableString(row.district),
    effectiveUntil: toNullableIsoString(row.effectiveUntil),
    hasDetailEvidence: toBooleanFlag(row.hasDetailEvidence),
    industryText: toNullableString(row.industryText),
    isGuangdong: toBooleanFlag(row.isGuangdong),
    lastSyncedAt: toNullableIsoString(row.lastSyncedAt),
    opportunityId:
      toSafeNumber(row.opportunityId) ?? toNullableString(row.opportunityId),
    opportunityStatus: toNullableString(row.opportunityStatus) || 'UNKNOWN',
    opportunityType,
    phoneNumber: toNullableString(row.phoneNumber),
    priceText: toNullableString(row.priceText),
    publishedAgeLabel: toNullableString(row.publishedAgeLabel),
    publishedAt: toNullableIsoString(row.publishedAt),
    publishedDateText: toNullableString(row.publishedDateText),
    qualityGrade: toNullableString(row.qualityGrade),
    score: toSafeNumber(row.score),
    sourceCode: toNullableString(row.sourceCode),
    sourceId: toSafeNumber(row.sourceId) ?? toNullableString(row.sourceId),
    sourceSite: toNullableString(row.sourceSite),
    sourceTable: toNullableString(row.sourceTable),
    sourceUrl: toNullableString(row.sourceUrl) || '',
    tagsJson: parseTagsJson(row.tagsJson),
    title: toNullableString(row.title),
  };
}

export function serializePublicOpportunityRows(
  rows: PublicOpportunityRawRow[],
) {
  return rows.map((row) => serializePublicOpportunityRow(row));
}

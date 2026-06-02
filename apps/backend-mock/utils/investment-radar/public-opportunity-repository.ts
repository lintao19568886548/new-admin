import type {
  PublicOpportunityQualityResult,
  PublicOpportunityQualityStatus,
} from './public-opportunity-quality';

import { createHash, randomUUID } from 'node:crypto';

import { prismaClient } from '~/utils/db';

import { rebuildExternalLeadsFromPublicOpportunity } from './public-opportunity-lead-rebuilder';
import { buildPublicOpportunityMaterializedFields } from './public-opportunity-materialized-fields';
import {
  evaluatePublicOpportunityQuality,
  parsePublicPublishedAt,
} from './public-opportunity-quality';
import { assertInvestmentRadarTableReady } from './schema-guard';

type PublicOpportunityType = 'DEMAND' | 'SUPPLY';

const CRAWLER_WRITABLE_QUALITY_STATUSES =
  new Set<PublicOpportunityQualityStatus>(['EFFECTIVE', 'VERIFIED']);

export class PublicOpportunityQualitySkipError extends Error {
  qualityResult: PublicOpportunityQualityResult;
  skipReason: string;

  constructor(qualityResult: PublicOpportunityQualityResult) {
    const skipReason = `QUALITY_${qualityResult.status}`;
    super(skipReason);
    this.name = 'PublicOpportunityQualitySkipError';
    this.qualityResult = qualityResult;
    this.skipReason = skipReason;
  }
}

export interface PublicOpportunityManualInput {
  areaText?: null | string;
  city?: null | string;
  contactName?: null | string;
  description?: null | string;
  district?: null | string;
  industryText?: null | string;
  opportunityType: PublicOpportunityType;
  phoneNumber?: null | string;
  priceText?: null | string;
  sourceSite?: null | string;
  sourceUrl?: null | string;
  title: string;
}

export interface PublicOpportunityCrawlerInput extends PublicOpportunityManualInput {
  detailJson?: unknown;
  opportunityStatus?: null | string;
  publishedAt?: null | string;
  publishedDateText?: null | string;
  score?: null | number;
  sourceTable?: null | string;
  tagsJson?: unknown;
}

export interface RadarCollectTaskResult {
  task: {
    created: number;
    durationMs: null | number;
    errorReason: null | string;
    skipped: number;
    status: 'FAILED' | 'PENDING' | 'RUNNING' | 'SUCCESS';
    taskId: string;
    updated: number;
  };
  taskId: string;
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeOptionalString(value: unknown, maxLength = 255) {
  const normalized = normalizeString(value);
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeOpportunityType(value: unknown): PublicOpportunityType {
  return value === 'SUPPLY' ? 'SUPPLY' : 'DEMAND';
}

function normalizeManualInput(input: PublicOpportunityManualInput) {
  const title = normalizeString(input.title);
  if (!title) {
    throw new Error('title is required');
  }

  const opportunityType = normalizeOpportunityType(input.opportunityType);
  const rawSourceUrl = normalizeOptionalString(input.sourceUrl, 500);
  const sourceUrl =
    rawSourceUrl || `manual://public-opportunity/${randomUUID()}`;
  const sourceSite =
    normalizeOptionalString(input.sourceSite, 100) ||
    inferSourceSite(sourceUrl) ||
    'manual';

  return {
    areaText: normalizeOptionalString(input.areaText, 100),
    city: normalizeOptionalString(input.city, 100),
    contactName: normalizeOptionalString(input.contactName, 100),
    description: normalizeOptionalString(input.description, 5000),
    district: normalizeOptionalString(input.district, 100),
    industryText: normalizeOptionalString(input.industryText, 100),
    opportunityType,
    phoneNumber: normalizeOptionalString(input.phoneNumber, 50),
    priceText: normalizeOptionalString(input.priceText, 100),
    sourceSite,
    sourceUrl,
    title: title.slice(0, 255),
  };
}

function inferSourceSite(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    return url.hostname.replace(/^www\./, '').slice(0, 100);
  } catch {
    return null;
  }
}

function toJson(value: unknown) {
  return JSON.stringify(value, (_key, v) =>
    typeof v === 'bigint' ? v.toString() : v,
  );
}

function normalizeDetailJsonObject(value: unknown) {
  if (!value || Array.isArray(value)) {
    return null;
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function buildManualSourceId(sourceUrl: string) {
  const hash = createHash('sha256').update(sourceUrl).digest('hex');
  return Number.parseInt(hash.slice(0, 7), 16);
}

function buildSourceId(sourceUrl: string) {
  const hash = createHash('sha256').update(sourceUrl).digest('hex');
  return Number.parseInt(hash.slice(0, 7), 16);
}

function normalizeCrawlerInput(input: PublicOpportunityCrawlerInput) {
  const title = normalizeString(input.title);
  if (!title) {
    throw new Error('title is required');
  }

  const rawSourceUrl = normalizeOptionalString(input.sourceUrl, 500);
  if (!rawSourceUrl) {
    throw new PublicOpportunityQualitySkipError({
      city: null,
      missingFields: ['sourceUrl'],
      reasons: ['SOURCE_URL_MISSING_OR_INVALID'],
      status: 'SOURCE_LOST',
    });
  }

  const publishedAt = input.publishedAt
    ? new Date(String(input.publishedAt))
    : null;
  const parsedPublishedDateText = parsePublicPublishedAt(
    input.publishedDateText,
  );
  let validPublishedAt: null | string = null;
  if (publishedAt && !Number.isNaN(publishedAt.getTime())) {
    validPublishedAt = publishedAt.toISOString();
  } else if (parsedPublishedDateText) {
    validPublishedAt = parsedPublishedDateText.toISOString();
  }
  const detailJson = input.detailJson ?? null;
  const detailJsonObject = normalizeDetailJsonObject(detailJson);
  const opportunityType = normalizeOpportunityType(input.opportunityType);
  const qualityResult = evaluatePublicOpportunityQuality({
    areaText: input.areaText,
    city: input.city,
    contactName: input.contactName,
    description: input.description,
    detailJson: detailJsonObject,
    district: input.district,
    opportunityStatus: input.opportunityStatus,
    opportunityType,
    phoneNumber: input.phoneNumber,
    priceText: input.priceText,
    publishedAt: validPublishedAt,
    publishedDateText: input.publishedDateText,
    sourceSite: input.sourceSite,
    sourceUrl: rawSourceUrl,
    title,
  });
  const qualityDetailJson = {
    ...detailJsonObject,
    qualityResult,
  };

  return {
    areaText: normalizeOptionalString(input.areaText, 100),
    city: normalizeOptionalString(input.city, 100),
    contactName: normalizeOptionalString(input.contactName, 100),
    description: normalizeOptionalString(input.description, 5000),
    detailJson: qualityDetailJson,
    district: normalizeOptionalString(input.district, 100),
    industryText: normalizeOptionalString(input.industryText, 100),
    opportunityStatus: qualityResult.status,
    opportunityType,
    phoneNumber: normalizeOptionalString(input.phoneNumber, 50),
    priceText: normalizeOptionalString(input.priceText, 100),
    publishedAt: validPublishedAt,
    publishedDateText:
      normalizeOptionalString(input.publishedDateText, 100) ||
      validPublishedAt?.slice(0, 10) ||
      null,
    score:
      Number.isFinite(Number(input.score)) && Number(input.score) > 0
        ? Math.floor(Number(input.score))
        : 70,
    sourceId: buildSourceId(rawSourceUrl),
    sourceKey: rawSourceUrl.slice(0, 160),
    sourceSite:
      normalizeOptionalString(input.sourceSite, 100) ||
      inferSourceSite(rawSourceUrl) ||
      'public_crawler',
    sourceTable: normalizeOptionalString(input.sourceTable, 100) || 'crawler',
    sourceUrl: rawSourceUrl,
    tagsJson: input.tagsJson ?? [
      'crawler',
      opportunityType,
      qualityResult.status,
    ],
    title: title.slice(0, 255),
    qualityResult,
  };
}

type NormalizedCrawlerInput = ReturnType<typeof normalizeCrawlerInput>;

async function findExistingCrawlerPublicOpportunityId(
  normalized: NormalizedCrawlerInput,
) {
  const existingRows = await prismaClient.$queryRawUnsafe<
    Array<{ opportunityId: bigint | number }>
  >(
    `
      SELECT opportunity_id AS opportunityId
      FROM investment_public_opportunity
      WHERE (opportunity_type = ? AND source_table = ? AND source_key = ?)
        OR (opportunity_type = ? AND source_url = ?)
      ORDER BY
        CASE
          WHEN opportunity_type = ? AND source_url = ? THEN 0
          ELSE 1
        END,
        opportunity_id ASC
      LIMIT 1
    `,
    normalized.opportunityType,
    normalized.sourceTable,
    normalized.sourceKey,
    normalized.opportunityType,
    normalized.sourceUrl,
    normalized.opportunityType,
    normalized.sourceUrl,
  );
  return existingRows[0]?.opportunityId
    ? Number(existingRows[0].opportunityId)
    : 0;
}

async function downgradeExistingCrawlerPublicOpportunity(
  existingId: number,
  normalized: NormalizedCrawlerInput,
) {
  if (existingId <= 0) {
    return false;
  }

  const materializedFields = buildPublicOpportunityMaterializedFields({
    detailJson: normalized.detailJson,
    opportunityType: normalized.opportunityType,
    qualityResult: normalized.qualityResult,
    sourceSite: normalized.sourceSite,
    tagsJson: normalized.tagsJson,
  });
  const affectedRows = await prismaClient.$executeRawUnsafe(
    `
      UPDATE investment_public_opportunity
      SET
        opportunity_status = ?,
        source_code = ?,
        is_guangdong = ?,
        has_detail_evidence = ?,
        quality_grade = ?,
        detail_json = ?,
        last_synced_at = NOW(3),
        update_time = NOW(3)
      WHERE opportunity_id = ?
        AND opportunity_status IN ('EFFECTIVE', 'VERIFIED')
    `,
    normalized.qualityResult.status,
    materializedFields.sourceCode,
    materializedFields.isGuangdong ? 1 : 0,
    materializedFields.hasDetailEvidence ? 1 : 0,
    materializedFields.qualityGrade,
    toJson(normalized.detailJson),
    existingId,
  );

  return Number(affectedRows || 0) > 0;
}

async function hasTableColumn(tableName: string, columnName: string) {
  const rows = await prismaClient.$queryRawUnsafe<Array<{ total: number }>>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `,
    tableName,
    columnName,
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function hasTableIndex(tableName: string, indexName: string) {
  const rows = await prismaClient.$queryRawUnsafe<Array<{ total: number }>>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
    `,
    tableName,
    indexName,
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function ensureColumn(
  tableName: string,
  columnName: string,
  ddl: string,
) {
  if (await hasTableColumn(tableName, columnName)) {
    return;
  }
  await prismaClient.$executeRawUnsafe(`ALTER TABLE ${tableName} ${ddl}`);
}

async function ensureIndex(tableName: string, indexName: string, ddl: string) {
  if (await hasTableIndex(tableName, indexName)) {
    return;
  }
  await prismaClient.$executeRawUnsafe(`ALTER TABLE ${tableName} ${ddl}`);
}

export async function ensurePublicOpportunityStorage() {
  await assertInvestmentRadarTableReady('investment_public_opportunity');

  await ensureColumn(
    'investment_public_opportunity',
    'source_table',
    'ADD COLUMN source_table varchar(100) NULL DEFAULT NULL AFTER source_url',
  );
  await ensureColumn(
    'investment_public_opportunity',
    'source_id',
    'ADD COLUMN source_id int NOT NULL DEFAULT 0 AFTER source_table',
  );
  await ensureColumn(
    'investment_public_opportunity',
    'source_key',
    'ADD COLUMN source_key varchar(160) NULL DEFAULT NULL AFTER source_url',
  );
  await ensureColumn(
    'investment_public_opportunity',
    'detail_json',
    'ADD COLUMN detail_json longtext NULL AFTER tags_json',
  );
  await ensureColumn(
    'investment_public_opportunity',
    'last_synced_at',
    'ADD COLUMN last_synced_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER detail_json',
  );
  await ensureColumn(
    'investment_public_opportunity',
    'source_code',
    'ADD COLUMN source_code varchar(80) NULL DEFAULT NULL AFTER opportunity_status',
  );
  await ensureColumn(
    'investment_public_opportunity',
    'is_guangdong',
    'ADD COLUMN is_guangdong tinyint NOT NULL DEFAULT 0 AFTER source_code',
  );
  await ensureColumn(
    'investment_public_opportunity',
    'has_detail_evidence',
    'ADD COLUMN has_detail_evidence tinyint NOT NULL DEFAULT 0 AFTER is_guangdong',
  );
  await ensureColumn(
    'investment_public_opportunity',
    'quality_grade',
    'ADD COLUMN quality_grade varchar(30) NULL DEFAULT NULL AFTER has_detail_evidence',
  );
  await ensureIndex(
    'investment_public_opportunity',
    'investment_public_opportunity_effective_idx',
    'ADD KEY investment_public_opportunity_effective_idx (opportunity_type, opportunity_status, published_at)',
  );
  await ensureIndex(
    'investment_public_opportunity',
    'investment_public_opportunity_type_published_synced_idx',
    'ADD KEY investment_public_opportunity_type_published_synced_idx (opportunity_type, published_at, last_synced_at, opportunity_id)',
  );
  await ensureIndex(
    'investment_public_opportunity',
    'investment_public_opportunity_quality_idx',
    'ADD KEY investment_public_opportunity_quality_idx (opportunity_status, is_guangdong, has_detail_evidence)',
  );
  await ensureIndex(
    'investment_public_opportunity',
    'investment_public_opportunity_source_code_idx',
    'ADD KEY investment_public_opportunity_source_code_idx (source_code, opportunity_status)',
  );
  await ensureIndex(
    'investment_public_opportunity',
    'investment_public_opportunity_strict_list_idx',
    'ADD KEY investment_public_opportunity_strict_list_idx (opportunity_type, opportunity_status, quality_grade, is_guangdong, has_detail_evidence, published_at, last_synced_at, opportunity_id)',
  );
  await ensureIndex(
    'investment_public_opportunity',
    'investment_public_opportunity_strict_source_list_idx',
    'ADD KEY investment_public_opportunity_strict_source_list_idx (opportunity_type, opportunity_status, source_site, quality_grade, is_guangdong, has_detail_evidence, published_at, last_synced_at, opportunity_id)',
  );
}

export async function ensureRadarCollectTaskStorage() {
  await assertInvestmentRadarTableReady('investment_radar_collect_task');

  await ensureColumn(
    'investment_radar_collect_task',
    'total',
    'ADD COLUMN total int NOT NULL DEFAULT 0 AFTER skipped',
  );
  await ensureColumn(
    'investment_radar_collect_task',
    'started_at',
    'ADD COLUMN started_at datetime(3) NULL DEFAULT NULL AFTER error_reason',
  );
  await ensureColumn(
    'investment_radar_collect_task',
    'completed_at',
    'ADD COLUMN completed_at datetime(3) NULL DEFAULT NULL AFTER started_at',
  );
}

export async function upsertManualPublicOpportunity(
  input: PublicOpportunityManualInput,
) {
  await ensurePublicOpportunityStorage();

  const normalized = normalizeManualInput(input);
  const manualDetailJson = {
    manual: true,
    source: 'manual_emergency_input',
  };
  const manualQualityResult = evaluatePublicOpportunityQuality({
    areaText: normalized.areaText,
    city: normalized.city,
    contactName: normalized.contactName,
    description: normalized.description,
    detailJson: manualDetailJson,
    district: normalized.district,
    opportunityType: normalized.opportunityType,
    phoneNumber: normalized.phoneNumber,
    priceText: normalized.priceText,
    publishedAt: new Date(),
    publishedDateText: new Date().toISOString().slice(0, 10),
    sourceSite: normalized.sourceSite,
    sourceUrl: normalized.sourceUrl,
    title: normalized.title,
  });
  const detailJson = toJson({
    ...manualDetailJson,
    qualityResult: manualQualityResult,
  });
  const tagsJson = toJson(['manual', normalized.opportunityType]);
  const materializedFields = buildPublicOpportunityMaterializedFields({
    detailJson: manualDetailJson,
    opportunityType: normalized.opportunityType,
    qualityResult: manualQualityResult,
    sourceSite: normalized.sourceSite,
    tagsJson,
  });
  const sourceId = buildManualSourceId(normalized.sourceUrl);
  const sourceKey = normalized.sourceUrl.slice(0, 160);
  const existingRows = await prismaClient.$queryRawUnsafe<
    Array<{ opportunityId: bigint | number }>
  >(
    `
      SELECT opportunity_id AS opportunityId
      FROM investment_public_opportunity
      WHERE source_table = 'manual_input' AND source_id = ?
      ORDER BY opportunity_id DESC
      LIMIT 1
    `,
    sourceId,
  );
  const existingId = existingRows[0]?.opportunityId
    ? Number(existingRows[0].opportunityId)
    : 0;

  if (existingId > 0) {
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE investment_public_opportunity
        SET
          opportunity_type = ?,
          source_site = ?,
          source_table = 'manual_input',
          source_id = ?,
          source_key = ?,
          title = ?,
          city = ?,
          district = ?,
          area_text = ?,
          price_text = ?,
          industry_text = ?,
          contact_name = ?,
          phone_number = ?,
          description = ?,
          published_at = NOW(3),
          published_date_text = DATE_FORMAT(NOW(), '%Y-%m-%d'),
          opportunity_status = 'EFFECTIVE',
          source_code = ?,
          is_guangdong = ?,
          has_detail_evidence = ?,
          quality_grade = ?,
          score = 70,
          tags_json = ?,
          detail_json = ?,
          last_synced_at = NOW(3),
          update_time = NOW(3)
        WHERE opportunity_id = ?
      `,
      normalized.opportunityType,
      normalized.sourceSite,
      sourceId,
      sourceKey,
      normalized.title,
      normalized.city,
      normalized.district,
      normalized.areaText,
      normalized.priceText,
      normalized.industryText,
      normalized.contactName,
      normalized.phoneNumber,
      normalized.description,
      materializedFields.sourceCode,
      materializedFields.isGuangdong ? 1 : 0,
      materializedFields.hasDetailEvidence ? 1 : 0,
      materializedFields.qualityGrade,
      tagsJson,
      detailJson,
      existingId,
    );
    return {
      created: false,
      opportunity: await getPublicOpportunityById(existingId),
    };
  }

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_public_opportunity (
        opportunity_type, source_site, source_url, source_key, source_table, source_id,
        title, city, district, area_text, price_text, industry_text,
        contact_name, phone_number, description, published_at,
        published_date_text, opportunity_status, source_code, is_guangdong,
        has_detail_evidence, quality_grade, score, tags_json,
        detail_json, last_synced_at, create_time, update_time
      )
      VALUES (
        ?, ?, ?, ?, 'manual_input', ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, NOW(3),
        DATE_FORMAT(NOW(), '%Y-%m-%d'), 'EFFECTIVE', ?, ?, ?, ?, 70, ?,
        ?, NOW(3), NOW(3), NOW(3)
      )
    `,
    normalized.opportunityType,
    normalized.sourceSite,
    normalized.sourceUrl,
    sourceKey,
    sourceId,
    normalized.title,
    normalized.city,
    normalized.district,
    normalized.areaText,
    normalized.priceText,
    normalized.industryText,
    normalized.contactName,
    normalized.phoneNumber,
    normalized.description,
    materializedFields.sourceCode,
    materializedFields.isGuangdong ? 1 : 0,
    materializedFields.hasDetailEvidence ? 1 : 0,
    materializedFields.qualityGrade,
    tagsJson,
    detailJson,
  );

  const rows = await prismaClient.$queryRawUnsafe<
    Array<{ opportunityId: bigint | number }>
  >(
    `
      SELECT opportunity_id AS opportunityId
      FROM investment_public_opportunity
      WHERE source_table = 'manual_input' AND source_id = ?
      ORDER BY opportunity_id DESC
      LIMIT 1
    `,
    sourceId,
  );
  const opportunityId = Number(rows[0]?.opportunityId || 0);
  if (!opportunityId) {
    throw new Error('create manual public opportunity failed');
  }
  return {
    created: true,
    opportunity: await getPublicOpportunityById(opportunityId),
  };
}

export async function upsertCrawlerPublicOpportunity(
  input: PublicOpportunityCrawlerInput,
) {
  await ensurePublicOpportunityStorage();

  const normalized = normalizeCrawlerInput(input);
  const existingId = await findExistingCrawlerPublicOpportunityId(normalized);
  if (!CRAWLER_WRITABLE_QUALITY_STATUSES.has(normalized.qualityResult.status)) {
    await downgradeExistingCrawlerPublicOpportunity(existingId, normalized);
    throw new PublicOpportunityQualitySkipError(normalized.qualityResult);
  }

  const detailJson = toJson(normalized.detailJson);
  const tagsJson = toJson(normalized.tagsJson);
  const materializedFields = buildPublicOpportunityMaterializedFields({
    detailJson: normalized.detailJson,
    opportunityType: normalized.opportunityType,
    qualityResult: normalized.qualityResult,
    sourceSite: normalized.sourceSite,
    tagsJson: normalized.tagsJson,
  });

  if (existingId > 0) {
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE investment_public_opportunity
        SET
          opportunity_type = ?,
          source_site = ?,
          source_url = ?,
          source_key = ?,
          source_table = ?,
          source_id = ?,
          title = ?,
          city = ?,
          district = ?,
          area_text = ?,
          price_text = ?,
          industry_text = ?,
          contact_name = ?,
          phone_number = ?,
          description = ?,
          published_at = ?,
          published_date_text = ?,
          opportunity_status = ?,
          source_code = ?,
          is_guangdong = ?,
          has_detail_evidence = ?,
          quality_grade = ?,
          score = ?,
          tags_json = ?,
          detail_json = ?,
          last_synced_at = NOW(3),
          update_time = NOW(3)
        WHERE opportunity_id = ?
      `,
      normalized.opportunityType,
      normalized.sourceSite,
      normalized.sourceUrl,
      normalized.sourceKey,
      normalized.sourceTable,
      normalized.sourceId,
      normalized.title,
      normalized.city,
      normalized.district,
      normalized.areaText,
      normalized.priceText,
      normalized.industryText,
      normalized.contactName,
      normalized.phoneNumber,
      normalized.description,
      normalized.publishedAt ? new Date(normalized.publishedAt) : null,
      normalized.publishedDateText,
      normalized.opportunityStatus,
      materializedFields.sourceCode,
      materializedFields.isGuangdong ? 1 : 0,
      materializedFields.hasDetailEvidence ? 1 : 0,
      materializedFields.qualityGrade,
      normalized.score,
      tagsJson,
      detailJson,
      existingId,
    );
    return {
      created: false,
      opportunity: await getPublicOpportunityById(existingId),
      qualityResult: normalized.qualityResult,
    };
  }

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_public_opportunity (
        opportunity_type, source_site, source_url, source_key, source_table, source_id,
        title, city, district, area_text, price_text, industry_text,
        contact_name, phone_number, description, published_at,
        published_date_text, opportunity_status, source_code, is_guangdong,
        has_detail_evidence, quality_grade, score, tags_json,
        detail_json, last_synced_at, create_time, update_time
      )
      VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, NOW(3), NOW(3), NOW(3)
      )
    `,
    normalized.opportunityType,
    normalized.sourceSite,
    normalized.sourceUrl,
    normalized.sourceKey,
    normalized.sourceTable,
    normalized.sourceId,
    normalized.title,
    normalized.city,
    normalized.district,
    normalized.areaText,
    normalized.priceText,
    normalized.industryText,
    normalized.contactName,
    normalized.phoneNumber,
    normalized.description,
    normalized.publishedAt ? new Date(normalized.publishedAt) : null,
    normalized.publishedDateText,
    normalized.opportunityStatus,
    materializedFields.sourceCode,
    materializedFields.isGuangdong ? 1 : 0,
    materializedFields.hasDetailEvidence ? 1 : 0,
    materializedFields.qualityGrade,
    normalized.score,
    tagsJson,
    detailJson,
  );

  const rows = await prismaClient.$queryRawUnsafe<
    Array<{ opportunityId: bigint | number }>
  >(
    `
      SELECT opportunity_id AS opportunityId
      FROM investment_public_opportunity
      WHERE opportunity_type = ? AND source_table = ? AND source_key = ?
      ORDER BY opportunity_id DESC
      LIMIT 1
    `,
    normalized.opportunityType,
    normalized.sourceTable,
    normalized.sourceKey,
  );
  const opportunityId = Number(rows[0]?.opportunityId || 0);
  if (!opportunityId) {
    throw new Error('create crawler public opportunity failed');
  }
  return {
    created: true,
    opportunity: await getPublicOpportunityById(opportunityId),
    qualityResult: normalized.qualityResult,
  };
}

export async function getPublicOpportunityById(opportunityId: number) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        opportunity_id AS opportunityId,
        opportunity_type AS opportunityType,
        source_site AS sourceSite,
        source_url AS sourceUrl,
        source_table AS sourceTable,
        source_id AS sourceId,
        title,
        city,
        district,
        area_text AS areaText,
        area_sqm AS areaSqm,
        price_text AS priceText,
        industry_text AS industryText,
        contact_name AS contactName,
        phone_number AS phoneNumber,
        description,
        published_at AS publishedAt,
        published_date_text AS publishedDateText,
        effective_until AS effectiveUntil,
        opportunity_status AS opportunityStatus,
        source_code AS sourceCode,
        is_guangdong AS isGuangdong,
        has_detail_evidence AS hasDetailEvidence,
        quality_grade AS qualityGrade,
        score,
        tags_json AS tagsJson,
        detail_json AS detailJson,
        last_synced_at AS lastSyncedAt
      FROM investment_public_opportunity
      WHERE opportunity_id = ?
      LIMIT 1
    `,
    opportunityId,
  );
  return rows[0] || null;
}

async function getRadarCollectTask(taskId: string) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        task_id AS taskId,
        status,
        created,
        updated,
        skipped,
        duration_ms AS durationMs,
        error_reason AS errorReason
      FROM investment_radar_collect_task
      WHERE task_id = ?
      LIMIT 1
    `,
    taskId,
  );
  const task = rows[0];
  if (!task) {
    throw new Error('collect task not found');
  }
  return {
    created: Number(task.created || 0),
    durationMs:
      task.durationMs === null || task.durationMs === undefined
        ? null
        : Number(task.durationMs),
    errorReason: task.errorReason || null,
    skipped: Number(task.skipped || 0),
    status: task.status || 'FAILED',
    taskId: String(task.taskId),
    updated: Number(task.updated || 0),
  };
}

export async function runPublicOpportunityCollectTask(): Promise<RadarCollectTaskResult> {
  await ensurePublicOpportunityStorage();
  await ensureRadarCollectTaskStorage();

  const taskId = `radar_collect_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const startedAt = Date.now();
  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_radar_collect_task (
        task_id, status, created, updated, skipped, total,
        started_at, create_time, update_time
      )
      VALUES (?, 'RUNNING', 0, 0, 0, 0, NOW(3), NOW(3), NOW(3))
    `,
    taskId,
  );

  try {
    const rebuildResult = await rebuildExternalLeadsFromPublicOpportunity();
    const durationMs = Date.now() - startedAt;
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE investment_radar_collect_task
        SET
          status = 'SUCCESS',
          created = ?,
          updated = ?,
          skipped = ?,
          total = ?,
          duration_ms = ?,
          error_reason = NULL,
          completed_at = NOW(3),
          update_time = NOW(3)
        WHERE task_id = ?
      `,
      rebuildResult.createdLeadCount,
      rebuildResult.updatedLeadCount,
      rebuildResult.skippedCount,
      rebuildResult.scannedCount,
      durationMs,
      taskId,
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE investment_radar_collect_task
        SET
          status = 'FAILED',
          duration_ms = ?,
          error_reason = ?,
          completed_at = NOW(3),
          update_time = NOW(3)
        WHERE task_id = ?
      `,
      durationMs,
      message.slice(0, 500),
      taskId,
    );
  }

  return {
    task: await getRadarCollectTask(taskId),
    taskId,
  };
}

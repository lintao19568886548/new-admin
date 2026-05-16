import { prismaClient } from '~/utils/db';

import { externalLeadFixtures } from './external-lead-mock';
import {
  buildExternalLeadDedupeKey,
  buildExternalLeadEvidenceHash,
  isSha256Hex,
} from './lead-hash';

type ExternalLeadStatus =
  | 'ASSIGNED'
  | 'FOLLOWING'
  | 'INVALID'
  | 'NEW'
  | 'PENDING_REVIEW'
  | 'VISITED'
  | 'WON';

const validStatuses = new Set<ExternalLeadStatus>([
  'ASSIGNED',
  'FOLLOWING',
  'INVALID',
  'NEW',
  'PENDING_REVIEW',
  'VISITED',
  'WON',
]);

export interface ExternalLeadListParams {
  confidenceLevel?: string;
  currentPage: number;
  demandType?: string;
  industryName?: string;
  keyword?: string;
  pageSize: number;
  regionCity?: string;
  sourceName?: string;
  status?: string;
}

export interface ExternalLeadUpdatePayload {
  invalidReason?: null | string;
  ownerUserId?: null | number;
  remark?: null | string;
  status?: ExternalLeadStatus;
}

export interface ExternalLeadConvertPayload {
  ownerUserId?: null | number;
  remark?: null | string;
}

export interface ExternalLeadEvidenceUpsertInput {
  crawledAt?: null | string;
  evidenceType: 'BODY' | 'EIA' | 'NOTICE' | 'RECRUITMENT' | 'TITLE';
  matchedKeywords?: string[];
  matchedSentences?: string[];
  publishedAt?: null | string;
  rawText?: null | string;
  scoreDelta?: number;
  sourceLink: string;
  sourceTitle?: null | string;
}

export interface ExternalLeadCrawlerUpsertInput {
  companyName: string;
  confidenceLevel: 'HIGH' | 'LOW' | 'MEDIUM';
  confidenceScore: number;
  crawledAt?: null | string;
  demandType: 'EXPAND' | 'NEW_LINE' | 'RELOCATION' | 'RENT_FACTORY' | 'UNKNOWN';
  evidences: ExternalLeadEvidenceUpsertInput[];
  hitKeywords?: string[];
  industryName?: null | string;
  leadTitle: string;
  regionCity?: null | string;
  regionDistrict?: null | string;
  regionProvince?: null | string;
  sourceId?: null | number;
  sourceName: string;
  sourceTitle?: null | string;
  sourceType?: null | string;
  sourceUrl: string;
  summary?: null | string;
}

export interface ExternalLeadCrawlerUpsertResult {
  created: boolean;
  evidenceCreatedCount: number;
  evidenceIds: number[];
  evidenceUpdatedCount: number;
  leadId: number;
  updated: boolean;
}

export class ExternalLeadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExternalLeadValidationError';
  }
}

function toJson(value: unknown) {
  return JSON.stringify(value ?? []);
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toNullableDate(value: unknown) {
  if (!value) {
    return null;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
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
  tableName: 'company_lead' | 'lead_evidence',
  columnName: string,
  ddl: string,
) {
  if (await hasTableColumn(tableName, columnName)) {
    return;
  }
  await prismaClient.$executeRawUnsafe(`ALTER TABLE ${tableName} ${ddl}`);
}

async function ensureIndex(
  tableName: 'company_lead' | 'lead_evidence',
  indexName: string,
  ddl: string,
) {
  if (await hasTableIndex(tableName, indexName)) {
    return;
  }
  await prismaClient.$executeRawUnsafe(`ALTER TABLE ${tableName} ${ddl}`);
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function validateCrawlerLeadInput(input: ExternalLeadCrawlerUpsertInput) {
  const sourceUrl = normalizeString(input.sourceUrl);
  const companyName = normalizeString(input.companyName);
  if (!sourceUrl) {
    throw new ExternalLeadValidationError('sourceUrl required');
  }
  if (!companyName) {
    throw new ExternalLeadValidationError('companyName required');
  }
  if (
    input.confidenceLevel === 'LOW' ||
    Number(input.confidenceScore || 0) < 60
  ) {
    throw new ExternalLeadValidationError('low confidence lead skipped');
  }
  if (input.evidences.length === 0) {
    throw new ExternalLeadValidationError('evidence required');
  }
  for (const evidence of input.evidences) {
    if (!normalizeString(evidence.sourceLink)) {
      throw new ExternalLeadValidationError('evidence sourceLink required');
    }
    const contentHash = buildExternalLeadEvidenceHash({
      evidenceType: evidence.evidenceType,
      rawText: evidence.rawText,
      sourceLink: normalizeString(evidence.sourceLink),
    });
    if (!isSha256Hex(contentHash)) {
      throw new ExternalLeadValidationError(
        'evidence content hash must be SHA-256 hex',
      );
    }
  }
  return {
    companyName,
    sourceUrl,
  };
}

function mapLeadRow(row: any) {
  return {
    companyName: row.companyName || '',
    confidenceLevel: row.confidenceLevel || 'LOW',
    confidenceScore: Number(row.confidenceScore || 0),
    convertedAt: row.convertedAt || null,
    convertedRadarLeadId:
      row.convertedRadarLeadId === null ||
      row.convertedRadarLeadId === undefined
        ? null
        : Number(row.convertedRadarLeadId),
    crawledAt: row.crawledAt || null,
    demandType: row.demandType || 'UNKNOWN',
    evidenceCount: Number(row.evidenceCount || 0),
    firstSeenAt: row.firstSeenAt || null,
    hitKeywords: parseJsonArray(row.hitKeywords),
    industryName: row.industryName || null,
    invalidReason: row.invalidReason || null,
    lastSeenAt: row.lastSeenAt || null,
    leadId: Number(row.leadId),
    leadTitle: row.leadTitle || '',
    ownerName: row.ownerName || null,
    ownerUserId:
      row.ownerUserId === null || row.ownerUserId === undefined
        ? null
        : Number(row.ownerUserId),
    regionCity: row.regionCity || null,
    regionDistrict: row.regionDistrict || null,
    regionProvince: row.regionProvince || null,
    remark: row.remark || null,
    sourceId:
      row.sourceId === null || row.sourceId === undefined
        ? null
        : Number(row.sourceId),
    sourceName: row.sourceName || '',
    sourceTitle: row.sourceTitle || null,
    sourceType: row.sourceType || 'PUBLIC',
    sourceUrl: row.sourceUrl || '',
    status: row.status || 'NEW',
    summary: row.summary || null,
    updateTime: row.updateTime || null,
  };
}

function mapEvidenceRow(row: any) {
  return {
    contentHash: row.contentHash || '',
    crawledAt: row.crawledAt || null,
    evidenceId: Number(row.evidenceId),
    evidenceType: row.evidenceType || '',
    leadId: Number(row.leadId),
    matchedKeywords: parseJsonArray(row.matchedKeywords),
    matchedSentences: parseJsonArray(row.matchedSentences),
    publishedAt: row.publishedAt || null,
    rawText: row.rawText || null,
    scoreDelta: Number(row.scoreDelta || 0),
    sourceLink: row.sourceLink || '',
    sourceTitle: row.sourceTitle || '',
  };
}

export async function ensureExternalLeadStorage() {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS company_lead (
      lead_id bigint NOT NULL AUTO_INCREMENT,
      source_id bigint NULL DEFAULT NULL,
      source_name varchar(100) NOT NULL,
      source_url varchar(500) NOT NULL,
      source_title varchar(255) NULL DEFAULT NULL,
      source_type varchar(50) NOT NULL DEFAULT 'PUBLIC',
      company_name varchar(200) NOT NULL,
      lead_title varchar(255) NOT NULL,
      summary text NULL,
      demand_type varchar(50) NOT NULL DEFAULT 'UNKNOWN',
      confidence_score int NOT NULL DEFAULT 0,
      confidence_level varchar(20) NOT NULL DEFAULT 'LOW',
      industry_name varchar(100) NULL DEFAULT NULL,
      region_province varchar(100) NULL DEFAULT NULL,
      region_city varchar(100) NULL DEFAULT NULL,
      region_district varchar(100) NULL DEFAULT NULL,
      hit_keywords text NULL,
      evidence_count int NOT NULL DEFAULT 0,
      status varchar(30) NOT NULL DEFAULT 'NEW',
      owner_user_id int NULL DEFAULT NULL,
      invalid_reason varchar(255) NULL DEFAULT NULL,
      remark text NULL,
      dedupe_key varchar(191) NOT NULL,
      converted_radar_lead_id bigint NULL DEFAULT NULL,
      converted_at datetime(3) NULL DEFAULT NULL,
      first_seen_at datetime(3) NULL DEFAULT NULL,
      last_seen_at datetime(3) NULL DEFAULT NULL,
      crawled_at datetime(3) NULL DEFAULT NULL,
      create_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      is_deleted tinyint NOT NULL DEFAULT 0,
      PRIMARY KEY (lead_id),
      UNIQUE KEY company_lead_dedupe_key_uq (dedupe_key),
      KEY company_lead_company_name_idx (company_name),
      KEY company_lead_status_idx (status),
      KEY company_lead_source_name_idx (source_name),
      KEY company_lead_converted_radar_lead_id_idx (converted_radar_lead_id)
    ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS lead_evidence (
      evidence_id bigint NOT NULL AUTO_INCREMENT,
      lead_id bigint NOT NULL,
      evidence_type varchar(50) NOT NULL,
      source_title varchar(255) NULL DEFAULT NULL,
      source_link varchar(500) NOT NULL,
      raw_text text NULL,
      matched_keywords text NULL,
      matched_sentences text NULL,
      score_delta int NOT NULL DEFAULT 0,
      content_hash varchar(80) NOT NULL,
      published_at datetime(3) NULL DEFAULT NULL,
      crawled_at datetime(3) NULL DEFAULT NULL,
      create_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      is_deleted tinyint NOT NULL DEFAULT 0,
      PRIMARY KEY (evidence_id),
      UNIQUE KEY lead_evidence_lead_hash_uq (lead_id, content_hash),
      KEY lead_evidence_lead_id_idx (lead_id),
      KEY lead_evidence_type_idx (evidence_type)
    ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  `);

  await ensureColumn(
    'company_lead',
    'source_title',
    'ADD COLUMN source_title varchar(255) NULL DEFAULT NULL AFTER source_url',
  );
  await ensureColumn(
    'company_lead',
    'source_type',
    "ADD COLUMN source_type varchar(50) NOT NULL DEFAULT 'PUBLIC' AFTER source_title",
  );
  await ensureColumn(
    'company_lead',
    'hit_keywords',
    'ADD COLUMN hit_keywords text NULL AFTER region_district',
  );
  await ensureColumn(
    'company_lead',
    'is_deleted',
    'ADD COLUMN is_deleted tinyint NOT NULL DEFAULT 0 AFTER update_time',
  );
  await ensureColumn(
    'lead_evidence',
    'matched_keywords',
    'ADD COLUMN matched_keywords text NULL AFTER raw_text',
  );
  await ensureColumn(
    'lead_evidence',
    'matched_sentences',
    'ADD COLUMN matched_sentences text NULL AFTER matched_keywords',
  );
  await ensureColumn(
    'lead_evidence',
    'update_time',
    'ADD COLUMN update_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER create_time',
  );
  await ensureColumn(
    'lead_evidence',
    'is_deleted',
    'ADD COLUMN is_deleted tinyint NOT NULL DEFAULT 0 AFTER update_time',
  );
  await repairLegacyEvidenceContentHashes();
  await pruneAllDuplicateEvidenceByContentHash();
  await repairDuplicateEvidenceHashesForUniqueIndex();
  await ensureIndex(
    'company_lead',
    'company_lead_dedupe_key_uq',
    'ADD UNIQUE KEY company_lead_dedupe_key_uq (dedupe_key)',
  );
  await ensureIndex(
    'lead_evidence',
    'lead_evidence_lead_hash_uq',
    'ADD UNIQUE KEY lead_evidence_lead_hash_uq (lead_id, content_hash)',
  );
}

export async function seedExternalLeadFixtures() {
  await ensureExternalLeadStorage();

  for (const fixture of externalLeadFixtures) {
    const dedupeKey = buildExternalLeadDedupeKey({
      companyName: fixture.companyName,
      sourceUrl: fixture.sourceUrl,
    });
    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO company_lead (
          source_name, source_url, source_title, source_type,
          company_name, lead_title, summary, demand_type,
          confidence_score, confidence_level, industry_name,
          region_province, region_city, region_district, hit_keywords,
          evidence_count, status, dedupe_key,
          first_seen_at, last_seen_at, crawled_at,
          create_time, update_time
        )
        VALUES (?, ?, ?, 'PUBLIC', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          source_title = VALUES(source_title),
          summary = VALUES(summary),
          confidence_score = VALUES(confidence_score),
          confidence_level = VALUES(confidence_level),
          hit_keywords = VALUES(hit_keywords),
          evidence_count = VALUES(evidence_count),
          last_seen_at = VALUES(last_seen_at),
          crawled_at = VALUES(crawled_at),
          update_time = NOW(3)
      `,
      fixture.sourceName,
      fixture.sourceUrl,
      fixture.sourceTitle,
      fixture.companyName,
      fixture.leadTitle,
      fixture.summary,
      fixture.demandType,
      fixture.confidenceScore,
      fixture.confidenceLevel,
      fixture.industryName || null,
      fixture.regionProvince || null,
      fixture.regionCity || null,
      fixture.regionDistrict || null,
      toJson(fixture.hitKeywords),
      fixture.evidences.length,
      dedupeKey,
      toNullableDate(fixture.crawledAt),
      toNullableDate(fixture.crawledAt),
      toNullableDate(fixture.crawledAt),
    );

    const lead = await getExternalLeadByDedupeKey(dedupeKey);
    if (!lead) {
      continue;
    }

    for (const evidence of fixture.evidences) {
      const contentHash = buildExternalLeadEvidenceHash({
        evidenceType: evidence.evidenceType,
        rawText: evidence.rawText,
        sourceLink: evidence.sourceLink,
      });
      await prismaClient.$executeRawUnsafe(
        `
          INSERT INTO lead_evidence (
            lead_id, evidence_type, source_title, source_link, raw_text,
            matched_keywords, matched_sentences, score_delta, content_hash,
            published_at, crawled_at, create_time, update_time
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
          ON DUPLICATE KEY UPDATE
            source_title = VALUES(source_title),
            raw_text = VALUES(raw_text),
            matched_keywords = VALUES(matched_keywords),
            matched_sentences = VALUES(matched_sentences),
            score_delta = VALUES(score_delta),
            published_at = VALUES(published_at),
            crawled_at = VALUES(crawled_at),
            update_time = NOW(3)
        `,
        lead.leadId,
        evidence.evidenceType,
        evidence.sourceTitle,
        evidence.sourceLink,
        evidence.rawText,
        toJson(evidence.matchedKeywords),
        toJson(evidence.matchedSentences),
        evidence.scoreDelta,
        contentHash,
        toNullableDate(evidence.publishedAt),
        toNullableDate(evidence.crawledAt),
      );
    }

    await refreshExternalLeadEvidenceCount(lead.leadId);
  }
}

async function ensureSeeded() {
  await seedExternalLeadFixtures();
}

async function refreshExternalLeadEvidenceCount(leadId: number) {
  await prismaClient.$executeRawUnsafe(
    `
      UPDATE company_lead
      SET evidence_count = (
        SELECT COUNT(*)
        FROM lead_evidence
        WHERE lead_id = ? AND is_deleted = 0
      ),
      update_time = NOW(3)
      WHERE lead_id = ?
    `,
    leadId,
    leadId,
  );
}

async function getExternalLeadByDedupeKey(dedupeKey: string) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT lead_id AS leadId
      FROM company_lead
      WHERE dedupe_key = ? AND is_deleted = 0
      LIMIT 1
    `,
    dedupeKey,
  );
  return rows[0] ? { leadId: Number(rows[0].leadId) } : null;
}

async function getEvidenceByContentHash(leadId: number, contentHash: string) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT evidence_id AS evidenceId
      FROM lead_evidence
      WHERE lead_id = ? AND content_hash = ? AND is_deleted = 0
      LIMIT 1
    `,
    leadId,
    contentHash,
  );
  return rows[0] ? { evidenceId: Number(rows[0].evidenceId) } : null;
}

async function pruneDuplicateEvidenceByContentHash(
  leadId: number,
  contentHash: string,
) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT evidence_id AS evidenceId
      FROM lead_evidence
      WHERE lead_id = ? AND content_hash = ? AND is_deleted = 0
      ORDER BY evidence_id ASC
    `,
    leadId,
    contentHash,
  );
  const duplicateIds = rows
    .slice(1)
    .map((row) => Number(row.evidenceId))
    .filter((evidenceId) => Number.isFinite(evidenceId) && evidenceId > 0);
  if (duplicateIds.length === 0) {
    return;
  }
  await prismaClient.$executeRawUnsafe(
    `
      UPDATE lead_evidence
      SET is_deleted = 1, update_time = NOW(3)
      WHERE evidence_id IN (${duplicateIds.map(() => '?').join(', ')})
    `,
    ...duplicateIds,
  );
}

async function repairLegacyEvidenceContentHashes() {
  const rows = await prismaClient.$queryRawUnsafe<
    Array<{
      evidenceId: bigint | number;
      evidenceType: string;
      rawText?: null | string;
      sourceLink: string;
    }>
  >(
    `
      SELECT
        evidence_id AS evidenceId,
        evidence_type AS evidenceType,
        source_link AS sourceLink,
        raw_text AS rawText
      FROM lead_evidence
      WHERE is_deleted = 0
        AND content_hash NOT REGEXP '^[a-f0-9]{64}$'
    `,
  );
  for (const row of rows) {
    const contentHash = buildExternalLeadEvidenceHash({
      evidenceType: row.evidenceType,
      rawText: row.rawText,
      sourceLink: row.sourceLink,
    });
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE lead_evidence
        SET content_hash = ?, update_time = NOW(3)
        WHERE evidence_id = ?
      `,
      contentHash,
      Number(row.evidenceId),
    );
  }
}

async function pruneAllDuplicateEvidenceByContentHash() {
  const rows = await prismaClient.$queryRawUnsafe<
    Array<{
      contentHash: string;
      leadId: bigint | number;
    }>
  >(
    `
      SELECT lead_id AS leadId, content_hash AS contentHash
      FROM lead_evidence
      WHERE is_deleted = 0
      GROUP BY lead_id, content_hash
      HAVING COUNT(*) > 1
    `,
  );
  for (const row of rows) {
    await pruneDuplicateEvidenceByContentHash(
      Number(row.leadId),
      row.contentHash,
    );
  }
}

async function repairDuplicateEvidenceHashesForUniqueIndex() {
  const rows = await prismaClient.$queryRawUnsafe<
    Array<{
      contentHash: string;
      evidenceId: bigint | number;
      evidenceType: string;
      rawText?: null | string;
      sourceLink: string;
    }>
  >(
    `
      SELECT
        le.evidence_id AS evidenceId,
        le.evidence_type AS evidenceType,
        le.source_link AS sourceLink,
        le.raw_text AS rawText,
        le.content_hash AS contentHash
      FROM lead_evidence le
      INNER JOIN (
        SELECT lead_id, content_hash
        FROM lead_evidence
        GROUP BY lead_id, content_hash
        HAVING COUNT(*) > 1
      ) dup
        ON dup.lead_id = le.lead_id
        AND dup.content_hash = le.content_hash
      ORDER BY le.lead_id ASC, le.is_deleted ASC, le.evidence_id ASC
    `,
  );
  const seen = new Set<string>();
  for (const row of rows) {
    const groupKey = String(row.contentHash);
    if (!seen.has(groupKey)) {
      seen.add(groupKey);
      continue;
    }
    const contentHash = buildExternalLeadEvidenceHash({
      evidenceType: row.evidenceType,
      rawText: `${row.rawText || ''}\nlegacyDuplicateEvidenceId:${row.evidenceId}`,
      sourceLink: row.sourceLink,
    });
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE lead_evidence
        SET content_hash = ?, update_time = NOW(3)
        WHERE evidence_id = ?
      `,
      contentHash,
      Number(row.evidenceId),
    );
  }
}

function buildLeadSelectSql() {
  return `
    SELECT
      l.lead_id AS leadId,
      l.source_id AS sourceId,
      l.source_name AS sourceName,
      l.source_url AS sourceUrl,
      l.source_title AS sourceTitle,
      l.source_type AS sourceType,
      l.company_name AS companyName,
      l.lead_title AS leadTitle,
      l.summary,
      l.demand_type AS demandType,
      l.confidence_score AS confidenceScore,
      l.confidence_level AS confidenceLevel,
      l.industry_name AS industryName,
      l.region_province AS regionProvince,
      l.region_city AS regionCity,
      l.region_district AS regionDistrict,
      l.hit_keywords AS hitKeywords,
      l.evidence_count AS evidenceCount,
      l.status,
      l.owner_user_id AS ownerUserId,
      COALESCE(u.real_name, u.username) AS ownerName,
      l.invalid_reason AS invalidReason,
      l.remark,
      l.converted_radar_lead_id AS convertedRadarLeadId,
      l.converted_at AS convertedAt,
      l.first_seen_at AS firstSeenAt,
      l.last_seen_at AS lastSeenAt,
      l.crawled_at AS crawledAt,
      l.update_time AS updateTime
    FROM company_lead l
    LEFT JOIN user u ON u.id = l.owner_user_id
  `;
}

export async function listExternalLeads(params: ExternalLeadListParams) {
  await ensureSeeded();

  const whereClauses = ['l.is_deleted = 0'];
  const whereParams: any[] = [];
  const appendLike = (sql: string, value?: string) => {
    if (!value) {
      return;
    }
    whereClauses.push(sql);
    whereParams.push(`%${value}%`);
  };

  if (params.status) {
    whereClauses.push('l.status = ?');
    whereParams.push(params.status);
  }
  if (params.confidenceLevel) {
    whereClauses.push('l.confidence_level = ?');
    whereParams.push(params.confidenceLevel);
  }
  if (params.demandType) {
    whereClauses.push('l.demand_type = ?');
    whereParams.push(params.demandType);
  }
  appendLike('l.region_city LIKE ?', params.regionCity);
  appendLike('l.industry_name LIKE ?', params.industryName);
  appendLike('l.source_name LIKE ?', params.sourceName);
  if (params.keyword) {
    whereClauses.push(
      '(l.company_name LIKE ? OR l.lead_title LIKE ? OR l.summary LIKE ? OR l.source_url LIKE ?)',
    );
    const keyword = `%${params.keyword}%`;
    whereParams.push(keyword, keyword, keyword, keyword);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
  const offset = (params.currentPage - 1) * params.pageSize;
  const [countRows, rows] = await Promise.all([
    prismaClient.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `
        SELECT COUNT(*) AS total
        FROM company_lead l
        ${whereSql}
      `,
      ...whereParams,
    ),
    prismaClient.$queryRawUnsafe<any[]>(
      `
        ${buildLeadSelectSql()}
        ${whereSql}
        ORDER BY l.update_time DESC, l.lead_id DESC
        LIMIT ? OFFSET ?
      `,
      ...whereParams,
      params.pageSize,
      offset,
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map((row) => mapLeadRow(row)),
    page: {
      currentPage: params.currentPage,
      pageSize: params.pageSize,
      total,
    },
    total,
  };
}

export async function getExternalLeadDetail(leadId: number) {
  await ensureSeeded();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      ${buildLeadSelectSql()}
      WHERE l.lead_id = ? AND l.is_deleted = 0
      LIMIT 1
    `,
    leadId,
  );
  const lead = rows[0] ? mapLeadRow(rows[0]) : null;
  if (!lead) {
    return null;
  }
  const evidences = await listExternalLeadEvidences(leadId);
  return {
    ...lead,
    evidences: evidences.items,
  };
}

export async function listExternalLeadEvidences(leadId: number) {
  await ensureSeeded();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        evidence_id AS evidenceId,
        lead_id AS leadId,
        evidence_type AS evidenceType,
        source_title AS sourceTitle,
        source_link AS sourceLink,
        raw_text AS rawText,
        matched_keywords AS matchedKeywords,
        matched_sentences AS matchedSentences,
        score_delta AS scoreDelta,
        content_hash AS contentHash,
        published_at AS publishedAt,
        crawled_at AS crawledAt
      FROM lead_evidence
      WHERE lead_id = ? AND is_deleted = 0
      ORDER BY score_delta DESC, evidence_id ASC
    `,
    leadId,
  );
  return {
    items: rows.map((row) => mapEvidenceRow(row)),
    total: rows.length,
  };
}

export async function upsertExternalLeadFromCrawler(
  input: ExternalLeadCrawlerUpsertInput,
): Promise<ExternalLeadCrawlerUpsertResult> {
  await ensureExternalLeadStorage();

  const normalized = validateCrawlerLeadInput(input);
  const dedupeKey = buildExternalLeadDedupeKey({
    companyName: normalized.companyName,
    sourceUrl: normalized.sourceUrl,
  });
  const existingLead = await getExternalLeadByDedupeKey(dedupeKey);
  const crawledAt = toNullableDate(input.crawledAt) || new Date();

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO company_lead (
        source_id, source_name, source_url, source_title, source_type,
        company_name, lead_title, summary, demand_type,
        confidence_score, confidence_level, industry_name,
        region_province, region_city, region_district, hit_keywords,
        evidence_count, status, dedupe_key,
        first_seen_at, last_seen_at, crawled_at,
        create_time, update_time
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        source_id = VALUES(source_id),
        source_name = VALUES(source_name),
        source_title = VALUES(source_title),
        source_type = VALUES(source_type),
        lead_title = VALUES(lead_title),
        summary = VALUES(summary),
        demand_type = VALUES(demand_type),
        confidence_score = VALUES(confidence_score),
        confidence_level = VALUES(confidence_level),
        industry_name = VALUES(industry_name),
        region_province = VALUES(region_province),
        region_city = VALUES(region_city),
        region_district = VALUES(region_district),
        hit_keywords = VALUES(hit_keywords),
        evidence_count = VALUES(evidence_count),
        last_seen_at = VALUES(last_seen_at),
        crawled_at = VALUES(crawled_at),
        update_time = NOW(3)
    `,
    input.sourceId || null,
    input.sourceName,
    normalized.sourceUrl,
    input.sourceTitle || null,
    input.sourceType || 'PUBLIC',
    normalized.companyName,
    input.leadTitle,
    input.summary || null,
    input.demandType,
    input.confidenceScore,
    input.confidenceLevel,
    input.industryName || null,
    input.regionProvince || null,
    input.regionCity || null,
    input.regionDistrict || null,
    toJson(input.hitKeywords || []),
    input.evidences.length,
    dedupeKey,
    crawledAt,
    crawledAt,
    crawledAt,
  );

  const lead = await getExternalLeadByDedupeKey(dedupeKey);
  if (!lead) {
    throw new Error('upsert external lead failed');
  }

  let evidenceCreatedCount = 0;
  const evidenceIds: number[] = [];
  let evidenceUpdatedCount = 0;
  for (const evidence of input.evidences) {
    const contentHash = buildExternalLeadEvidenceHash({
      evidenceType: evidence.evidenceType,
      rawText: evidence.rawText,
      sourceLink: normalizeString(evidence.sourceLink),
    });
    const existingEvidence = await getEvidenceByContentHash(
      lead.leadId,
      contentHash,
    );
    if (existingEvidence) {
      await prismaClient.$executeRawUnsafe(
        `
          UPDATE lead_evidence
          SET
            evidence_type = ?,
            source_title = ?,
            source_link = ?,
            raw_text = ?,
            matched_keywords = ?,
            matched_sentences = ?,
            score_delta = ?,
            published_at = ?,
            crawled_at = ?,
            update_time = NOW(3)
          WHERE evidence_id = ?
        `,
        evidence.evidenceType,
        evidence.sourceTitle || null,
        evidence.sourceLink,
        evidence.rawText || null,
        toJson(evidence.matchedKeywords || []),
        toJson(evidence.matchedSentences || []),
        evidence.scoreDelta || 0,
        toNullableDate(evidence.publishedAt),
        toNullableDate(evidence.crawledAt) || crawledAt,
        existingEvidence.evidenceId,
      );
      evidenceUpdatedCount += 1;
      evidenceIds.push(existingEvidence.evidenceId);
    } else {
      await prismaClient.$executeRawUnsafe(
        `
          INSERT INTO lead_evidence (
            lead_id, evidence_type, source_title, source_link, raw_text,
            matched_keywords, matched_sentences, score_delta, content_hash,
            published_at, crawled_at, create_time, update_time
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
        `,
        lead.leadId,
        evidence.evidenceType,
        evidence.sourceTitle || null,
        evidence.sourceLink,
        evidence.rawText || null,
        toJson(evidence.matchedKeywords || []),
        toJson(evidence.matchedSentences || []),
        evidence.scoreDelta || 0,
        contentHash,
        toNullableDate(evidence.publishedAt),
        toNullableDate(evidence.crawledAt) || crawledAt,
      );
      evidenceCreatedCount += 1;
      const createdEvidence = await getEvidenceByContentHash(
        lead.leadId,
        contentHash,
      );
      if (createdEvidence) {
        evidenceIds.push(createdEvidence.evidenceId);
      }
    }
    await pruneDuplicateEvidenceByContentHash(lead.leadId, contentHash);
  }

  await refreshExternalLeadEvidenceCount(lead.leadId);

  return {
    created: !existingLead,
    evidenceCreatedCount,
    evidenceIds,
    evidenceUpdatedCount,
    leadId: lead.leadId,
    updated: Boolean(existingLead),
  };
}

export async function updateExternalLead(
  leadId: number,
  payload: ExternalLeadUpdatePayload,
) {
  await ensureSeeded();

  const setClauses: string[] = [];
  const setParams: any[] = [];
  const pushSet = (sql: string, value: unknown) => {
    setClauses.push(sql);
    setParams.push(value);
  };

  if (payload.status !== undefined) {
    if (!validStatuses.has(payload.status)) {
      throw new ExternalLeadValidationError('status 无效');
    }
    pushSet('status = ?', payload.status);
  }
  if (payload.ownerUserId !== undefined) {
    pushSet(
      'owner_user_id = ?',
      payload.ownerUserId === null ? null : Number(payload.ownerUserId),
    );
  }
  if (payload.remark !== undefined) {
    pushSet('remark = ?', payload.remark || null);
  }
  if (payload.invalidReason !== undefined) {
    pushSet('invalid_reason = ?', payload.invalidReason || null);
  }

  if (setClauses.length === 0) {
    return getExternalLeadDetail(leadId);
  }

  const affected = await prismaClient.$executeRawUnsafe(
    `
      UPDATE company_lead
      SET ${setClauses.join(', ')}, update_time = NOW(3)
      WHERE lead_id = ? AND is_deleted = 0
    `,
    ...setParams,
    leadId,
  );
  if (Number(affected || 0) === 0) {
    return null;
  }
  return getExternalLeadDetail(leadId);
}

async function findEnterpriseByCompanyName(companyName: string) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT enterprise_id AS enterpriseId
      FROM investment_enterprise
      WHERE enterprise_name = ?
      LIMIT 1
    `,
    companyName,
  );
  return rows[0] ? Number(rows[0].enterpriseId) : null;
}

async function createEnterpriseFromExternalLead(
  lead: ReturnType<typeof mapLeadRow>,
) {
  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_enterprise (
        enterprise_name, industry_name, city, address,
        source_first, source_latest, last_signal_time,
        create_time, update_time
      )
      VALUES (?, ?, ?, ?, 'EXTERNAL_PUBLIC', ?, ?, NOW(3), NOW(3))
    `,
    lead.companyName,
    lead.industryName,
    lead.regionCity,
    [lead.regionProvince, lead.regionCity, lead.regionDistrict]
      .filter(Boolean)
      .join(' '),
    lead.demandType,
    lead.crawledAt || new Date(),
  );
  const enterpriseId = await findEnterpriseByCompanyName(lead.companyName);
  if (!enterpriseId) {
    throw new Error('create enterprise failed');
  }
  return enterpriseId;
}

async function findExistingRadarLead(enterpriseId: number) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT lead_id AS leadId
      FROM investment_lead
      WHERE enterprise_id = ? AND is_deleted = 0
      ORDER BY lead_id DESC
      LIMIT 1
    `,
    enterpriseId,
  );
  return rows[0] ? Number(rows[0].leadId) : null;
}

async function createRadarLeadFromExternalLead(params: {
  enterpriseId: number;
  lead: ReturnType<typeof mapLeadRow>;
  ownerUserId?: null | number;
}) {
  let priorityLevel = 'C';
  if (params.lead.confidenceScore >= 80) {
    priorityLevel = 'A';
  } else if (params.lead.confidenceScore >= 60) {
    priorityLevel = 'B';
  }

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_lead (
        enterprise_id, park_id, lead_source,
        intent_area, intent_score, match_score, reachable_score, total_score,
        priority_level, stage, owner_user_id, latest_contact_time,
        invalid_reason, create_time, update_time, is_deleted
      )
      VALUES (?, NULL, 'EXTERNAL_PUBLIC', NULL, ?, 0, 40, ?, ?, 'NEW', ?, NULL, NULL, NOW(3), NOW(3), 0)
    `,
    params.enterpriseId,
    Math.min(100, Math.max(0, params.lead.confidenceScore)),
    Math.min(100, Math.max(0, params.lead.confidenceScore)),
    priorityLevel,
    params.ownerUserId || params.lead.ownerUserId || null,
  );
  const radarLeadId = await findExistingRadarLead(params.enterpriseId);
  if (!radarLeadId) {
    throw new Error('create radar lead failed');
  }
  return radarLeadId;
}

export async function convertExternalLeadToRadarLead(
  leadId: number,
  payload: ExternalLeadConvertPayload,
) {
  await ensureSeeded();

  const lead = await getExternalLeadDetail(leadId);
  if (!lead) {
    return null;
  }
  if (lead.convertedRadarLeadId) {
    return {
      convertedAt: lead.convertedAt,
      externalLeadId: lead.leadId,
      radarLeadId: lead.convertedRadarLeadId,
      reused: true,
    };
  }

  let enterpriseId = await findEnterpriseByCompanyName(lead.companyName);
  if (!enterpriseId) {
    enterpriseId = await createEnterpriseFromExternalLead(lead);
  }

  let radarLeadId = await findExistingRadarLead(enterpriseId);
  const reused = Boolean(radarLeadId);
  if (!radarLeadId) {
    radarLeadId = await createRadarLeadFromExternalLead({
      enterpriseId,
      lead,
      ownerUserId: payload.ownerUserId,
    });
  }

  const remark = normalizeString(payload.remark);
  await prismaClient.$executeRawUnsafe(
    `
      UPDATE company_lead
      SET converted_radar_lead_id = ?,
          converted_at = COALESCE(converted_at, NOW(3)),
          status = CASE WHEN status = 'NEW' THEN 'PENDING_REVIEW' ELSE status END,
          owner_user_id = COALESCE(?, owner_user_id),
          remark = CASE WHEN ? = '' THEN remark ELSE ? END,
          update_time = NOW(3)
      WHERE lead_id = ? AND is_deleted = 0
    `,
    radarLeadId,
    payload.ownerUserId || null,
    remark,
    remark,
    leadId,
  );

  const updated = await getExternalLeadDetail(leadId);
  return {
    convertedAt: updated?.convertedAt || null,
    externalLeadId: lead.leadId,
    radarLeadId,
    reused,
  };
}

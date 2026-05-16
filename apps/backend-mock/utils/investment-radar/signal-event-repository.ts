import { prismaClient } from '~/utils/db';

import {
  convertExternalLeadToRadarLead,
  seedExternalLeadFixtures,
} from './external-lead-repository';
import { buildSignalEventHash, buildSignalEvidenceHash } from './lead-hash';
import { signalEventDemoConfig } from './signal-event-mock';

export type SignalEventType =
  | 'EIA_EXPAND'
  | 'FACTORY_RENT_DEMAND'
  | 'NEWS_EXPAND'
  | 'PUBLIC_FACTORY_DEMAND'
  | 'RECRUITMENT_EXPAND'
  | 'RELOCATION'
  | 'UNKNOWN';

export type SignalEventStatus = 'CONVERTED' | 'IGNORED' | 'NEW' | 'REVIEWED';

export interface SignalEventListParams {
  companyName?: string;
  currentPage: number;
  eventType?: string;
  keyword?: string;
  pageSize: number;
  sourceName?: string;
  sourceType?: string;
  status?: string;
}

export interface SignalEventUpdatePayload {
  status?: SignalEventStatus;
}

export interface SignalEventConvertPayload {
  ownerUserId?: null | number;
  remark?: null | string;
}

export class SignalEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignalEventValidationError';
  }
}

const validStatuses = new Set<SignalEventStatus>([
  'CONVERTED',
  'IGNORED',
  'NEW',
  'REVIEWED',
]);

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

function parseJsonObject(value: unknown): null | Record<string, unknown> {
  if (!value) {
    return null;
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

function inferEventType(lead: {
  demandType?: null | string;
  hitKeywords?: unknown;
  leadTitle?: null | string;
}) {
  const text = [
    lead.demandType,
    lead.leadTitle,
    ...parseJsonArray(lead.hitKeywords),
  ]
    .join(' ')
    .toLowerCase();

  if (lead.demandType === 'RELOCATION' || /搬迁|遷|relocation/.test(text)) {
    return 'RELOCATION' as const;
  }
  if (lead.demandType === 'RENT_FACTORY' || /租厂|厂房|factory/.test(text)) {
    return 'FACTORY_RENT_DEMAND' as const;
  }
  if (/招聘|recruitment|hiring/.test(text)) {
    return 'RECRUITMENT_EXPAND' as const;
  }
  if (/环评|eia|公示|扩建|新增产线|expand/.test(text)) {
    return 'EIA_EXPAND' as const;
  }
  if (/公开机会|public/.test(text)) {
    return 'PUBLIC_FACTORY_DEMAND' as const;
  }
  if (/新闻|news/.test(text)) {
    return 'NEWS_EXPAND' as const;
  }
  return 'UNKNOWN' as const;
}

function canRebuildSignalFromLead(lead: {
  confidenceLevel?: null | string;
  confidenceScore?: null | number | string;
  evidenceCount?: null | number | string;
  sourceUrl?: null | string;
}) {
  return (
    String(lead.sourceUrl || '').trim() &&
    Number(lead.evidenceCount || 0) > 0 &&
    lead.confidenceLevel !== 'LOW' &&
    Number(lead.confidenceScore || 0) >= 60
  );
}

function mapEventRow(row: any) {
  return {
    companyName: row.companyName || '',
    confidenceScore: Number(row.confidenceScore || 0),
    contentHash: row.contentHash || '',
    createTime: row.createTime || null,
    enterpriseId:
      row.enterpriseId === null || row.enterpriseId === undefined
        ? null
        : Number(row.enterpriseId),
    eventId: Number(row.eventId),
    eventSummary: row.eventSummary || null,
    eventTime: row.eventTime || null,
    eventTitle: row.eventTitle || '',
    eventType: row.eventType || 'UNKNOWN',
    rawPayloadJson: parseJsonObject(row.rawPayloadJson),
    relatedExternalLeadId:
      row.relatedExternalLeadId === null ||
      row.relatedExternalLeadId === undefined
        ? null
        : Number(row.relatedExternalLeadId),
    relatedRadarLeadId:
      row.relatedRadarLeadId === null || row.relatedRadarLeadId === undefined
        ? null
        : Number(row.relatedRadarLeadId),
    sourceName: row.sourceName || '',
    sourceType: row.sourceType || '',
    sourceUrl: row.sourceUrl || '',
    status: row.status || 'NEW',
    updateTime: row.updateTime || null,
  };
}

function mapEvidenceRow(row: any) {
  return {
    contentHash: row.contentHash || '',
    crawledAt: row.crawledAt || null,
    evidenceId: Number(row.evidenceId),
    evidenceType: row.evidenceType || '',
    eventId: Number(row.eventId),
    matchedKeywords: parseJsonArray(row.matchedKeywordsJson),
    matchedSentences: parseJsonArray(row.matchedSentencesJson),
    publishedAt: row.publishedAt || null,
    rawText: row.rawText || null,
    scoreDelta: Number(row.scoreDelta || 0),
    sourceLink: row.sourceLink || '',
    sourceTitle: row.sourceTitle || '',
  };
}

export async function ensureSignalEventStorage() {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS signal_event (
      event_id bigint NOT NULL AUTO_INCREMENT,
      enterprise_id bigint NULL DEFAULT NULL,
      company_name varchar(200) NOT NULL,
      event_type varchar(50) NOT NULL,
      event_title varchar(255) NOT NULL,
      event_summary text NULL,
      event_time datetime(3) NULL DEFAULT NULL,
      source_type varchar(50) NOT NULL,
      source_name varchar(100) NOT NULL,
      source_url varchar(500) NOT NULL,
      confidence_score int NOT NULL DEFAULT 0,
      status varchar(30) NOT NULL DEFAULT 'NEW',
      related_external_lead_id bigint NULL DEFAULT NULL,
      related_radar_lead_id bigint NULL DEFAULT NULL,
      content_hash varchar(80) NOT NULL,
      raw_payload_json text NULL,
      create_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      is_deleted tinyint NOT NULL DEFAULT 0,
      PRIMARY KEY (event_id),
      UNIQUE KEY signal_event_content_hash_uq (content_hash),
      KEY signal_event_company_name_idx (company_name),
      KEY signal_event_event_type_idx (event_type),
      KEY signal_event_status_idx (status),
      KEY signal_event_source_type_idx (source_type),
      KEY signal_event_external_lead_idx (related_external_lead_id),
      KEY signal_event_radar_lead_idx (related_radar_lead_id)
    ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS signal_evidence (
      evidence_id bigint NOT NULL AUTO_INCREMENT,
      event_id bigint NOT NULL,
      evidence_type varchar(50) NOT NULL,
      source_title varchar(255) NULL DEFAULT NULL,
      source_link varchar(500) NOT NULL,
      raw_text text NULL,
      matched_keywords_json text NULL,
      matched_sentences_json text NULL,
      score_delta int NOT NULL DEFAULT 0,
      content_hash varchar(80) NOT NULL,
      published_at datetime(3) NULL DEFAULT NULL,
      crawled_at datetime(3) NULL DEFAULT NULL,
      create_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      is_deleted tinyint NOT NULL DEFAULT 0,
      PRIMARY KEY (evidence_id),
      UNIQUE KEY signal_evidence_event_hash_uq (event_id, content_hash),
      KEY signal_evidence_event_id_idx (event_id),
      KEY signal_evidence_content_hash_idx (content_hash)
    ) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  `);
}

async function getSignalEventIdByHash(contentHash: string) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT event_id AS eventId
      FROM signal_event
      WHERE content_hash = ? AND is_deleted = 0
      LIMIT 1
    `,
    contentHash,
  );
  return rows[0] ? Number(rows[0].eventId) : null;
}

async function getSignalEvidenceIdByHash(eventId: number, contentHash: string) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT evidence_id AS evidenceId
      FROM signal_evidence
      WHERE event_id = ? AND content_hash = ? AND is_deleted = 0
      LIMIT 1
    `,
    eventId,
    contentHash,
  );
  return rows[0] ? Number(rows[0].evidenceId) : null;
}

async function softDeleteSignalsForDirtyExternalLeads() {
  const affected = await prismaClient.$executeRawUnsafe(
    `
      UPDATE signal_event se
      INNER JOIN company_lead cl
        ON cl.lead_id = se.related_external_lead_id
      SET se.is_deleted = 1,
          se.update_time = NOW(3)
      WHERE se.is_deleted = 0
        AND se.related_external_lead_id IS NOT NULL
        AND (
          cl.is_deleted <> 0
          OR cl.source_url IS NULL
          OR cl.source_url = ''
          OR cl.evidence_count <= 0
          OR cl.confidence_level = 'LOW'
          OR cl.confidence_score < 60
        )
    `,
  );
  return Number(affected || 0);
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

async function createEnterpriseFromSignalEvent(
  event: ReturnType<typeof mapEventRow>,
) {
  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_enterprise (
        enterprise_name, source_first, source_latest, last_signal_time,
        create_time, update_time
      )
      VALUES (?, 'SIGNAL_EVENT', ?, ?, NOW(3), NOW(3))
    `,
    event.companyName,
    event.eventType,
    event.eventTime || new Date(),
  );
  const enterpriseId = await findEnterpriseByCompanyName(event.companyName);
  if (!enterpriseId) {
    throw new Error('create enterprise from signal event failed');
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

async function createRadarLeadFromSignalEvent(params: {
  enterpriseId: number;
  event: ReturnType<typeof mapEventRow>;
  ownerUserId?: null | number;
}) {
  let priorityLevel = 'C';
  if (params.event.confidenceScore >= 80) {
    priorityLevel = 'A';
  } else if (params.event.confidenceScore >= 60) {
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
      VALUES (?, NULL, 'SIGNAL_EVENT', NULL, ?, 0, 40, ?, ?, 'NEW', ?, NULL, NULL, NOW(3), NOW(3), 0)
    `,
    params.enterpriseId,
    Math.min(100, Math.max(0, params.event.confidenceScore)),
    Math.min(100, Math.max(0, params.event.confidenceScore)),
    priorityLevel,
    params.ownerUserId || null,
  );
  const radarLeadId = await findExistingRadarLead(params.enterpriseId);
  if (!radarLeadId) {
    throw new Error('create radar lead from signal event failed');
  }
  return radarLeadId;
}

export async function rebuildSignalEventsFromExternalLeads() {
  await seedExternalLeadFixtures();
  await ensureSignalEventStorage();
  const deletedDirtyEventCount = await softDeleteSignalsForDirtyExternalLeads();

  const leads = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        lead_id AS leadId,
        company_name AS companyName,
        lead_title AS leadTitle,
        summary,
        demand_type AS demandType,
        confidence_score AS confidenceScore,
        confidence_level AS confidenceLevel,
        evidence_count AS evidenceCount,
        source_type AS sourceType,
        source_name AS sourceName,
        source_url AS sourceUrl,
        hit_keywords AS hitKeywords,
        converted_radar_lead_id AS convertedRadarLeadId,
        crawled_at AS crawledAt,
        update_time AS updateTime
      FROM company_lead
      WHERE is_deleted = 0
        AND source_url <> ''
        AND evidence_count > 0
        AND confidence_level <> 'LOW'
        AND confidence_score >= 60
      ORDER BY update_time DESC, lead_id DESC
    `,
  );

  let createdEventCount = 0;
  let updatedEventCount = 0;
  let createdEvidenceCount = 0;
  let updatedEvidenceCount = 0;

  for (const lead of leads) {
    if (!canRebuildSignalFromLead(lead)) {
      continue;
    }
    const eventType = inferEventType(lead);
    const contentHash = buildSignalEventHash({
      companyName: lead.companyName,
      eventTitle: lead.leadTitle,
      relatedExternalLeadId: Number(lead.leadId),
      sourceUrl: lead.sourceUrl,
    });
    const existingEventId = await getSignalEventIdByHash(contentHash);
    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO signal_event (
          enterprise_id, company_name, event_type, event_title, event_summary,
          event_time, source_type, source_name, source_url, confidence_score,
          status, related_external_lead_id, related_radar_lead_id,
          content_hash, raw_payload_json, create_time, update_time
        )
        VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          company_name = VALUES(company_name),
          event_type = VALUES(event_type),
          event_title = VALUES(event_title),
          event_summary = VALUES(event_summary),
          event_time = VALUES(event_time),
          source_type = VALUES(source_type),
          source_name = VALUES(source_name),
          source_url = VALUES(source_url),
          confidence_score = VALUES(confidence_score),
          related_external_lead_id = VALUES(related_external_lead_id),
          related_radar_lead_id = COALESCE(signal_event.related_radar_lead_id, VALUES(related_radar_lead_id)),
          is_deleted = 0,
          raw_payload_json = VALUES(raw_payload_json),
          update_time = NOW(3)
      `,
      lead.companyName,
      eventType,
      lead.leadTitle,
      lead.summary || null,
      lead.crawledAt || lead.updateTime || null,
      lead.sourceType || signalEventDemoConfig.sourceType,
      lead.sourceName || '',
      lead.sourceUrl,
      Number(lead.confidenceScore || 0),
      lead.convertedRadarLeadId ? 'CONVERTED' : 'NEW',
      Number(lead.leadId),
      lead.convertedRadarLeadId === null ||
        lead.convertedRadarLeadId === undefined
        ? null
        : Number(lead.convertedRadarLeadId),
      contentHash,
      JSON.stringify({
        demoConfig: signalEventDemoConfig.description,
        externalLeadId: Number(lead.leadId),
        hitKeywords: parseJsonArray(lead.hitKeywords),
      }),
    );

    const eventId =
      existingEventId || (await getSignalEventIdByHash(contentHash));
    if (!eventId) {
      continue;
    }
    if (existingEventId) {
      updatedEventCount += 1;
    } else {
      createdEventCount += 1;
    }

    const evidences = await prismaClient.$queryRawUnsafe<any[]>(
      `
        SELECT
          evidence_type AS evidenceType,
          source_title AS sourceTitle,
          source_link AS sourceLink,
          raw_text AS rawText,
          matched_keywords AS matchedKeywords,
          matched_sentences AS matchedSentences,
          score_delta AS scoreDelta,
          published_at AS publishedAt,
          crawled_at AS crawledAt
        FROM lead_evidence
        WHERE lead_id = ? AND is_deleted = 0
        ORDER BY score_delta DESC, evidence_id ASC
      `,
      Number(lead.leadId),
    );

    for (const evidence of evidences) {
      const evidenceHash = buildSignalEvidenceHash({
        evidenceType: evidence.evidenceType,
        rawText: evidence.rawText,
        sourceLink: evidence.sourceLink,
      });
      const existingEvidenceId = await getSignalEvidenceIdByHash(
        eventId,
        evidenceHash,
      );
      await prismaClient.$executeRawUnsafe(
        `
          INSERT INTO signal_evidence (
            event_id, evidence_type, source_title, source_link, raw_text,
            matched_keywords_json, matched_sentences_json, score_delta,
            content_hash, published_at, crawled_at, create_time, update_time
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
          ON DUPLICATE KEY UPDATE
            is_deleted = 0,
            evidence_type = VALUES(evidence_type),
            source_title = VALUES(source_title),
            source_link = VALUES(source_link),
            raw_text = VALUES(raw_text),
            matched_keywords_json = VALUES(matched_keywords_json),
            matched_sentences_json = VALUES(matched_sentences_json),
            score_delta = VALUES(score_delta),
            published_at = VALUES(published_at),
            crawled_at = VALUES(crawled_at),
            update_time = NOW(3)
        `,
        eventId,
        evidence.evidenceType,
        evidence.sourceTitle || null,
        evidence.sourceLink,
        evidence.rawText || null,
        toJson(parseJsonArray(evidence.matchedKeywords)),
        toJson(parseJsonArray(evidence.matchedSentences)),
        Number(evidence.scoreDelta || 0),
        evidenceHash,
        evidence.publishedAt || null,
        evidence.crawledAt || null,
      );
      if (existingEvidenceId) {
        updatedEvidenceCount += 1;
      } else {
        createdEvidenceCount += 1;
      }
    }
  }

  return {
    createdEventCount,
    createdEvidenceCount,
    deletedDirtyEventCount,
    totalSourceLeadCount: leads.length,
    updatedEventCount,
    updatedEvidenceCount,
  };
}

function buildSignalEventSelectSql() {
  return `
    SELECT
      event_id AS eventId,
      enterprise_id AS enterpriseId,
      company_name AS companyName,
      event_type AS eventType,
      event_title AS eventTitle,
      event_summary AS eventSummary,
      event_time AS eventTime,
      source_type AS sourceType,
      source_name AS sourceName,
      source_url AS sourceUrl,
      confidence_score AS confidenceScore,
      status,
      related_external_lead_id AS relatedExternalLeadId,
      related_radar_lead_id AS relatedRadarLeadId,
      content_hash AS contentHash,
      raw_payload_json AS rawPayloadJson,
      create_time AS createTime,
      update_time AS updateTime
    FROM signal_event
  `;
}

async function ensureSignalSeeded() {
  await ensureSignalEventStorage();
  const rows = await prismaClient.$queryRawUnsafe<
    Array<{ total: bigint | number }>
  >(
    `
      SELECT COUNT(*) AS total
      FROM signal_event
      WHERE is_deleted = 0
    `,
  );
  if (Number(rows[0]?.total || 0) > 0) {
    return;
  }
  await rebuildSignalEventsFromExternalLeads();
}

export async function listSignalEvents(params: SignalEventListParams) {
  await ensureSignalSeeded();

  const whereClauses = ['is_deleted = 0'];
  const whereParams: unknown[] = [];
  const appendLike = (sql: string, value?: string) => {
    if (!value) {
      return;
    }
    whereClauses.push(sql);
    whereParams.push(`%${value}%`);
  };

  if (params.eventType) {
    whereClauses.push('event_type = ?');
    whereParams.push(params.eventType);
  }
  if (params.status) {
    whereClauses.push('status = ?');
    whereParams.push(params.status);
  }
  if (params.sourceType) {
    whereClauses.push('source_type = ?');
    whereParams.push(params.sourceType);
  }
  appendLike('company_name LIKE ?', params.companyName);
  appendLike('source_name LIKE ?', params.sourceName);
  if (params.keyword) {
    whereClauses.push(
      '(company_name LIKE ? OR event_title LIKE ? OR event_summary LIKE ? OR source_url LIKE ?)',
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
        FROM signal_event
        ${whereSql}
      `,
      ...whereParams,
    ),
    prismaClient.$queryRawUnsafe<any[]>(
      `
        ${buildSignalEventSelectSql()}
        ${whereSql}
        ORDER BY event_time DESC, update_time DESC, event_id DESC
        LIMIT ? OFFSET ?
      `,
      ...whereParams,
      params.pageSize,
      offset,
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map((row) => mapEventRow(row)),
    page: {
      currentPage: params.currentPage,
      pageSize: params.pageSize,
      total,
    },
    total,
  };
}

export async function getSignalEventDetail(eventId: number) {
  await ensureSignalSeeded();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      ${buildSignalEventSelectSql()}
      WHERE event_id = ? AND is_deleted = 0
      LIMIT 1
    `,
    eventId,
  );
  const event = rows[0] ? mapEventRow(rows[0]) : null;
  if (!event) {
    return null;
  }
  const evidences = await listSignalEventEvidences(eventId);
  return {
    ...event,
    evidences: evidences.items,
  };
}

export async function listSignalEventEvidences(eventId: number) {
  await ensureSignalEventStorage();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        evidence_id AS evidenceId,
        event_id AS eventId,
        evidence_type AS evidenceType,
        source_title AS sourceTitle,
        source_link AS sourceLink,
        raw_text AS rawText,
        matched_keywords_json AS matchedKeywordsJson,
        matched_sentences_json AS matchedSentencesJson,
        score_delta AS scoreDelta,
        content_hash AS contentHash,
        published_at AS publishedAt,
        crawled_at AS crawledAt
      FROM signal_evidence
      WHERE event_id = ? AND is_deleted = 0
      ORDER BY score_delta DESC, evidence_id ASC
    `,
    eventId,
  );
  return {
    items: rows.map((row) => mapEvidenceRow(row)),
    total: rows.length,
  };
}

export async function updateSignalEvent(
  eventId: number,
  payload: SignalEventUpdatePayload,
) {
  await ensureSignalEventStorage();

  if (payload.status !== undefined && !validStatuses.has(payload.status)) {
    throw new SignalEventValidationError('status 无效');
  }
  if (payload.status === undefined) {
    return getSignalEventDetail(eventId);
  }

  const affected = await prismaClient.$executeRawUnsafe(
    `
      UPDATE signal_event
      SET status = ?, update_time = NOW(3)
      WHERE event_id = ? AND is_deleted = 0
    `,
    payload.status,
    eventId,
  );
  if (Number(affected || 0) === 0) {
    return null;
  }
  return getSignalEventDetail(eventId);
}

export async function convertSignalEventToRadarLead(
  eventId: number,
  payload: SignalEventConvertPayload,
) {
  await ensureSignalEventStorage();

  const event = await getSignalEventDetail(eventId);
  if (!event) {
    return null;
  }
  if (event.relatedRadarLeadId) {
    return {
      eventId: event.eventId,
      radarLeadId: event.relatedRadarLeadId,
      reused: true,
    };
  }

  let radarLeadId: number;
  let reused = false;
  if (event.relatedExternalLeadId) {
    const result = await convertExternalLeadToRadarLead(
      event.relatedExternalLeadId,
      {
        ownerUserId: payload.ownerUserId,
        remark: payload.remark || '企业信号确认有效，转入雷达潜客',
      },
    );
    if (!result) {
      throw new Error('related external lead convert failed');
    }
    radarLeadId = result.radarLeadId;
    reused = Boolean(result.reused);
  } else {
    let enterpriseId =
      event.enterpriseId ||
      (await findEnterpriseByCompanyName(event.companyName));
    if (!enterpriseId) {
      enterpriseId = await createEnterpriseFromSignalEvent(event);
    }
    const existingRadarLeadId = await findExistingRadarLead(enterpriseId);
    reused = Boolean(existingRadarLeadId);
    radarLeadId =
      existingRadarLeadId ||
      (await createRadarLeadFromSignalEvent({
        enterpriseId,
        event,
        ownerUserId: payload.ownerUserId,
      }));
  }

  await prismaClient.$executeRawUnsafe(
    `
      UPDATE signal_event
      SET related_radar_lead_id = ?,
          status = 'CONVERTED',
          update_time = NOW(3)
      WHERE event_id = ? AND is_deleted = 0
    `,
    radarLeadId,
    eventId,
  );

  return {
    eventId,
    radarLeadId,
    reused,
  };
}

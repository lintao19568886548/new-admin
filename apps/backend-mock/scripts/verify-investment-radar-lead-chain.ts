import type { PublicOpportunityRow } from '../utils/investment-radar/public-opportunity-lead-rebuilder';

import { prismaClient, prismaScopeStorage } from '../utils/db';
import { buildExternalLeadEvidenceHash } from '../utils/investment-radar/lead-hash';
import {
  buildExternalLeadInputFromPublicOpportunityRow,
  rebuildExternalLeadsFromPublicOpportunity,
} from '../utils/investment-radar/public-opportunity-lead-rebuilder';
import { rebuildSignalEventsFromExternalLeads } from '../utils/investment-radar/signal-event-repository';

type VerificationRecord = Record<string, unknown>;

const scope = {
  customerId:
    process.env.INVESTMENT_RADAR_CUSTOMER_ID ||
    process.env.DEFAULT_CUSTOMER_ID ||
    'default',
  dbName: process.env.INVESTMENT_RADAR_DB_NAME || undefined,
};

function nowIso() {
  return new Date().toISOString();
}

function demandRow(overrides: Partial<PublicOpportunityRow> = {}) {
  return {
    areaText: '5000㎡',
    city: '惠州市',
    contactName: '李经理',
    description:
      '企业名称：惠州长青智能装备有限公司。计划扩产并新增生产线，需要仓储配套。',
    detailJson: {
      companyName: '惠州长青智能装备有限公司',
    },
    district: '惠城区',
    industryText: '智能装备',
    lastSyncedAt: '2026-05-14T09:20:00+08:00',
    opportunityId: 900_001,
    opportunityType: 'DEMAND',
    phoneNumber: '13800000000',
    publishedAt: '2026-05-13T10:00:00+08:00',
    sourceSite: 'verify',
    sourceUrl: 'verify://public-opportunity/demand-900001',
    tagsJson: ['扩产', '生产线'],
    title: '智能装备企业扩产新增生产线厂房需求',
    ...overrides,
  } satisfies PublicOpportunityRow;
}

function buildRuleSamples() {
  const valid = buildExternalLeadInputFromPublicOpportunityRow(demandRow(), {
    crawledAt: '2026-05-14T09:20:00+08:00',
  });
  const evidence =
    valid.input?.evidences[0] ||
    (() => {
      throw new Error('valid sample did not build evidence');
    })();
  return {
    excludeKeyword: buildExternalLeadInputFromPublicOpportunityRow(
      demandRow({
        description:
          '企业名称：惠州长青智能装备有限公司。扩产需求用于活动宣传会议。',
      }),
    ).skipReason,
    hashSample: buildExternalLeadEvidenceHash({
      evidenceType: evidence.evidenceType,
      rawText: evidence.rawText,
      sourceLink: evidence.sourceLink,
    }),
    lowConfidence: buildExternalLeadInputFromPublicOpportunityRow(
      demandRow({
        areaText: null,
        city: null,
        contactName: null,
        description: '企业名称：惠州长青智能装备有限公司。计划扩产。',
        district: null,
        industryText: null,
        phoneNumber: null,
        tagsJson: [],
        title: '扩产',
      }),
    ).skipReason,
    missingSourceUrl: buildExternalLeadInputFromPublicOpportunityRow(
      demandRow({ sourceUrl: '' }),
    ).skipReason,
    noReliableCompanyName: buildExternalLeadInputFromPublicOpportunityRow(
      demandRow({
        description: '计划扩产并新增生产线，需要仓储配套。',
        detailJson: {},
        title: '惠州长青智能装备有限公司扩产新增生产线厂房需求',
      }),
    ).skipReason,
    notDemand: buildExternalLeadInputFromPublicOpportunityRow(
      demandRow({ opportunityType: 'SUPPLY' }),
    ).skipReason,
    validLead: {
      companyName: valid.input?.companyName,
      confidenceLevel: valid.input?.confidenceLevel,
      confidenceScore: valid.input?.confidenceScore,
      demandType: valid.input?.demandType,
      evidenceType: evidence.evidenceType,
      matchedKeywords: evidence.matchedKeywords,
      sourceUrl: valid.input?.sourceUrl,
    },
  };
}

async function countRows(fromSql: string, whereSql: string) {
  const rows = await prismaClient.$queryRawUnsafe<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total FROM ${fromSql} WHERE ${whereSql}`,
  );
  return Number(rows[0]?.total || 0);
}

async function sampleLeadAndEvidence() {
  const rows = await prismaClient.$queryRawUnsafe<VerificationRecord[]>(
    `
      SELECT
        l.lead_id AS leadId,
        l.company_name AS companyName,
        l.source_url AS sourceUrl,
        l.demand_type AS demandType,
        l.confidence_score AS confidenceScore,
        l.confidence_level AS confidenceLevel,
        l.hit_keywords AS hitKeywords,
        e.evidence_id AS evidenceId,
        e.evidence_type AS evidenceType,
        e.content_hash AS contentHash,
        e.source_link AS sourceLink
      FROM company_lead l
      INNER JOIN lead_evidence e ON e.lead_id = l.lead_id AND e.is_deleted = 0
      WHERE l.is_deleted = 0
        AND l.source_type = 'PUBLIC_OPPORTUNITY'
        AND l.confidence_score >= 60
        AND l.confidence_level <> 'LOW'
      ORDER BY l.update_time DESC, l.lead_id DESC, e.evidence_id ASC
      LIMIT 1
    `,
  );
  return rows[0] || null;
}

async function sampleSignal() {
  const rows = await prismaClient.$queryRawUnsafe<VerificationRecord[]>(
    `
      SELECT
        se.event_id AS eventId,
        se.company_name AS companyName,
        se.event_type AS eventType,
        se.event_title AS eventTitle,
        se.confidence_score AS confidenceScore,
        se.related_external_lead_id AS relatedExternalLeadId,
        sev.evidence_id AS evidenceId,
        sev.content_hash AS evidenceContentHash
      FROM signal_event se
      LEFT JOIN signal_evidence sev
        ON sev.event_id = se.event_id AND sev.is_deleted = 0
      WHERE se.is_deleted = 0
        AND se.related_external_lead_id IS NOT NULL
        AND se.confidence_score >= 60
      ORDER BY se.update_time DESC, se.event_id DESC, sev.evidence_id ASC
      LIMIT 1
    `,
  );
  return rows[0] || null;
}

async function verify() {
  return prismaScopeStorage.run(scope, async () => {
    const rules = buildRuleSamples();

    const firstExternal = await rebuildExternalLeadsFromPublicOpportunity();
    const secondExternal = await rebuildExternalLeadsFromPublicOpportunity();
    const firstSignal = await rebuildSignalEventsFromExternalLeads();
    const secondSignal = await rebuildSignalEventsFromExternalLeads();

    const lowConfidenceSignalCount = await countRows(
      'signal_event se INNER JOIN company_lead cl ON cl.lead_id = se.related_external_lead_id',
      "se.is_deleted = 0 AND (cl.confidence_level = 'LOW' OR cl.confidence_score < 60)",
    );
    const badEvidenceHashCount = await countRows(
      'lead_evidence',
      "is_deleted = 0 AND content_hash NOT REGEXP '^[a-f0-9]{64}$'",
    );
    const duplicateLeadCount = await countRows(
      '(SELECT dedupe_key FROM company_lead WHERE is_deleted = 0 GROUP BY dedupe_key HAVING COUNT(*) > 1) d',
      '1 = 1',
    );
    const duplicateEvidenceCount = await countRows(
      '(SELECT lead_id, content_hash FROM lead_evidence WHERE is_deleted = 0 GROUP BY lead_id, content_hash HAVING COUNT(*) > 1) d',
      '1 = 1',
    );

    const leadEvidenceSample = await sampleLeadAndEvidence();
    return {
      generatedAt: nowIso(),
      rules,
      dedupeChecks: {
        duplicateEvidenceCount,
        duplicateLeadCount,
      },
      hashChecks: {
        badEvidenceHashCount,
      },
      repeatedRuns: {
        externalFirst: firstExternal,
        externalSecond: secondExternal,
        signalFirst: firstSignal,
        signalSecond: secondSignal,
      },
      samples: {
        evidence: leadEvidenceSample,
        lead: leadEvidenceSample,
        signal: await sampleSignal(),
      },
      signalDirtyDataChecks: {
        lowConfidenceSignalCount,
      },
    };
  });
}

const result = await verify();
console.log(
  JSON.stringify(
    result,
    (_key, value) => (typeof value === 'bigint' ? Number(value) : value),
    2,
  ),
);

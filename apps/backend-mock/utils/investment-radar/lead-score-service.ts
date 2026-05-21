import { prismaClient } from '~/utils/db';

import { ensureProfileScoreStorage } from './enterprise-profile-repository';
import {
  getEnabledLeadScoreRules,
  seedDefaultScoreRules,
} from './score-rule-repository';
import { rebuildSignalEventsFromExternalLeads } from './signal-event-repository';

interface ScoreHit {
  eventId: null | number;
  reason: string;
  ruleCode: string;
  ruleId: number;
  ruleName: string;
  scoreDelta: number;
}

export interface LeadScoreRecalculateOptions {
  skipSignalRebuild?: boolean;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolvePriorityLevel(score: number) {
  if (score >= 80) {
    return 'A';
  }
  if (score >= 60) {
    return 'B';
  }
  if (score >= 40) {
    return 'C';
  }
  return 'D';
}

function mapBreakdownRow(row: any) {
  return {
    breakdownId: Number(row.breakdownId),
    createTime: row.createTime || null,
    eventId:
      row.eventId === null || row.eventId === undefined
        ? null
        : Number(row.eventId),
    eventTitle: row.eventTitle || null,
    eventType: row.eventType || null,
    leadId: Number(row.leadId),
    reason: row.reason || '',
    ruleCode: row.ruleCode || '',
    ruleId: Number(row.ruleId),
    ruleName: row.ruleName || '',
    scoreDelta: Number(row.scoreDelta || 0),
  };
}

async function getRadarLead(leadId: number) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        l.lead_id AS leadId,
        l.enterprise_id AS enterpriseId,
        e.enterprise_name AS enterpriseName
      FROM investment_lead l
      LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
      WHERE l.lead_id = ? AND l.is_deleted = 0
      LIMIT 1
    `,
    leadId,
  );
  const lead = rows[0];
  if (!lead) {
    return null;
  }
  return {
    enterpriseId:
      lead.enterpriseId === null || lead.enterpriseId === undefined
        ? null
        : Number(lead.enterpriseId),
    enterpriseName: lead.enterpriseName || '',
    leadId: Number(lead.leadId),
  };
}

async function getLeadSignalEvents(lead: {
  enterpriseId: null | number;
  enterpriseName: string;
  leadId: number;
}) {
  const whereClauses = ['se.is_deleted = 0'];
  const whereParams: unknown[] = [];
  const matchClauses = ['se.related_radar_lead_id = ?'];
  whereParams.push(lead.leadId);
  if (lead.enterpriseName) {
    matchClauses.push('se.company_name = ?');
    whereParams.push(lead.enterpriseName);
  }
  if (lead.enterpriseId) {
    matchClauses.push('se.enterprise_id = ?');
    whereParams.push(lead.enterpriseId);
  }
  whereClauses.push(`(${matchClauses.join(' OR ')})`);

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        se.event_id AS eventId,
        se.company_name AS companyName,
        se.event_type AS eventType,
        se.event_title AS eventTitle,
        se.event_summary AS eventSummary,
        se.source_url AS sourceUrl,
        se.confidence_score AS confidenceScore
      FROM signal_event se
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY se.event_time DESC, se.event_id DESC
    `,
    ...whereParams,
  );

  const events = [];
  for (const row of rows) {
    const evidenceRows = await prismaClient.$queryRawUnsafe<any[]>(
      `
        SELECT
          raw_text AS rawText,
          matched_keywords_json AS matchedKeywordsJson,
          matched_sentences_json AS matchedSentencesJson
        FROM signal_evidence
        WHERE event_id = ? AND is_deleted = 0
      `,
      Number(row.eventId),
    );
    const evidenceText = evidenceRows
      .map((evidence) =>
        [
          evidence.rawText,
          evidence.matchedKeywordsJson,
          evidence.matchedSentencesJson,
        ].join(' '),
      )
      .join(' ');
    events.push({
      companyName: row.companyName || '',
      confidenceScore: Number(row.confidenceScore || 0),
      eventId: Number(row.eventId),
      eventSummary: row.eventSummary || '',
      eventTitle: row.eventTitle || '',
      eventType: row.eventType || 'UNKNOWN',
      scoreText: [
        row.companyName,
        row.eventTitle,
        row.eventSummary,
        row.sourceUrl,
        evidenceText,
      ]
        .join(' ')
        .toLowerCase(),
      sourceUrl: row.sourceUrl || '',
    });
  }
  return events;
}

function buildScoreHits(params: {
  events: Awaited<ReturnType<typeof getLeadSignalEvents>>;
  rules: Awaited<ReturnType<typeof getEnabledLeadScoreRules>>;
}) {
  const hits: ScoreHit[] = [];
  for (const event of params.events) {
    for (const rule of params.rules) {
      if (rule.eventType && rule.eventType === event.eventType) {
        hits.push({
          eventId: event.eventId,
          reason: `事件类型 ${event.eventType} 命中：${event.eventTitle}`,
          ruleCode: rule.ruleCode,
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          scoreDelta: rule.scoreDelta,
        });
        continue;
      }

      if (rule.keywordJson.length > 0) {
        const hitKeyword = rule.keywordJson.find((keyword) =>
          event.scoreText.includes(keyword.toLowerCase()),
        );
        if (hitKeyword) {
          hits.push({
            eventId: event.eventId,
            reason: `关键词“${hitKeyword}”命中：${event.eventTitle}`,
            ruleCode: rule.ruleCode,
            ruleId: rule.ruleId,
            ruleName: rule.ruleName,
            scoreDelta: rule.scoreDelta,
          });
        }
      }
    }
  }
  return hits;
}

async function replaceLeadScoreBreakdown(leadId: number, hits: ScoreHit[]) {
  await prismaClient.$executeRawUnsafe(
    `
      DELETE FROM lead_score_breakdown
      WHERE lead_id = ?
    `,
    leadId,
  );

  for (const hit of hits) {
    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO lead_score_breakdown (
          lead_id, event_id, rule_id, rule_code, rule_name,
          score_delta, reason, create_time
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))
      `,
      leadId,
      hit.eventId,
      hit.ruleId,
      hit.ruleCode,
      hit.ruleName,
      hit.scoreDelta,
      hit.reason,
    );
  }
}

export async function recalculateRadarLeadScore(
  leadId: number,
  options: LeadScoreRecalculateOptions = {},
) {
  if (!options.skipSignalRebuild) {
    await rebuildSignalEventsFromExternalLeads();
  }
  await ensureProfileScoreStorage();
  await seedDefaultScoreRules();

  const lead = await getRadarLead(leadId);
  if (!lead) {
    return null;
  }

  const [events, rules] = await Promise.all([
    getLeadSignalEvents(lead),
    getEnabledLeadScoreRules(),
  ]);
  const hits = buildScoreHits({ events, rules });
  const rawScore = hits.reduce((sum, hit) => sum + hit.scoreDelta, 0);
  const intentScore = clampScore(rawScore);
  const totalScore = intentScore;
  const priorityLevel = resolvePriorityLevel(totalScore);

  await replaceLeadScoreBreakdown(leadId, hits);
  await prismaClient.$executeRawUnsafe(
    `
      UPDATE investment_lead
      SET intent_score = ?,
          total_score = ?,
          priority_level = ?,
          update_time = NOW(3)
      WHERE lead_id = ? AND is_deleted = 0
    `,
    intentScore,
    totalScore,
    priorityLevel,
    leadId,
  );

  return {
    breakdownCount: hits.length,
    intentScore,
    leadId,
    matchedEventCount: events.length,
    priorityLevel,
    totalScore,
  };
}

export async function listRadarLeadScoreBreakdown(leadId: number) {
  await ensureProfileScoreStorage();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        b.breakdown_id AS breakdownId,
        b.lead_id AS leadId,
        b.event_id AS eventId,
        b.rule_id AS ruleId,
        b.rule_code AS ruleCode,
        b.rule_name AS ruleName,
        b.score_delta AS scoreDelta,
        b.reason,
        b.create_time AS createTime,
        se.event_title AS eventTitle,
        se.event_type AS eventType
      FROM lead_score_breakdown b
      LEFT JOIN signal_event se ON se.event_id = b.event_id
      WHERE b.lead_id = ?
      ORDER BY b.score_delta DESC, b.breakdown_id ASC
    `,
    leadId,
  );
  return {
    items: rows.map((row) => mapBreakdownRow(row)),
    total: rows.length,
  };
}

export async function recalculateDemoLeadScores(
  options: LeadScoreRecalculateOptions = {},
) {
  if (!options.skipSignalRebuild) {
    await rebuildSignalEventsFromExternalLeads();
  }
  await ensureProfileScoreStorage();
  await seedDefaultScoreRules();

  const leadRows = await prismaClient.$queryRawUnsafe<any[]>(`
    SELECT DISTINCT
      l.lead_id AS leadId
    FROM investment_lead l
    LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
    WHERE l.is_deleted = 0
      AND (
        l.lead_source IN ('EXTERNAL_PUBLIC', 'SIGNAL_EVENT')
        OR EXISTS (
          SELECT 1
          FROM signal_event se
          WHERE se.is_deleted = 0
            AND (
              se.related_radar_lead_id = l.lead_id
              OR se.company_name = e.enterprise_name
              OR se.enterprise_id = l.enterprise_id
            )
        )
      )
    ORDER BY l.lead_id ASC
  `);

  const results = [];
  for (const row of leadRows) {
    const result = await recalculateRadarLeadScore(Number(row.leadId), {
      skipSignalRebuild: true,
    });
    if (result) {
      results.push(result);
    }
  }

  return {
    items: results,
    recalculatedCount: results.length,
    totalLeadCount: leadRows.length,
  };
}

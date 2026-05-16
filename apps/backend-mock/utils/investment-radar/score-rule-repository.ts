import { prismaClient } from '~/utils/db';

import { ensureProfileScoreStorage } from './enterprise-profile-repository';

export interface LeadScoreRuleUpdatePayload {
  enabled?: boolean;
  keywordJson?: null | string[];
  ruleDescription?: null | string;
  scoreDelta?: number;
}

export class LeadScoreRuleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeadScoreRuleValidationError';
  }
}

const defaultScoreRules = [
  {
    eventType: 'EIA_EXPAND',
    keywordJson: null,
    ruleCode: 'EVENT_EIA_EXPAND',
    ruleDescription: '命中环评、扩建、产线扩张类企业信号',
    ruleName: '环评扩产信号',
    scoreDelta: 35,
  },
  {
    eventType: 'RECRUITMENT_EXPAND',
    keywordJson: null,
    ruleCode: 'EVENT_RECRUITMENT_EXPAND',
    ruleDescription: '命中招聘扩张类企业信号',
    ruleName: '招聘扩张信号',
    scoreDelta: 30,
  },
  {
    eventType: 'RELOCATION',
    keywordJson: null,
    ruleCode: 'EVENT_RELOCATION',
    ruleDescription: '命中搬迁类企业信号',
    ruleName: '搬迁信号',
    scoreDelta: 35,
  },
  {
    eventType: 'FACTORY_RENT_DEMAND',
    keywordJson: null,
    ruleCode: 'EVENT_FACTORY_RENT_DEMAND',
    ruleDescription: '命中租厂需求类企业信号',
    ruleName: '租厂需求信号',
    scoreDelta: 45,
  },
  {
    eventType: 'PUBLIC_FACTORY_DEMAND',
    keywordJson: null,
    ruleCode: 'EVENT_PUBLIC_FACTORY_DEMAND',
    ruleDescription: '命中公开厂房需求类企业信号',
    ruleName: '公开厂房需求信号',
    scoreDelta: 35,
  },
  {
    eventType: 'NEWS_EXPAND',
    keywordJson: null,
    ruleCode: 'EVENT_NEWS_EXPAND',
    ruleDescription: '命中新闻扩张类企业信号',
    ruleName: '新闻扩张信号',
    scoreDelta: 20,
  },
  {
    eventType: 'UNKNOWN',
    keywordJson: null,
    ruleCode: 'EVENT_UNKNOWN',
    ruleDescription: '未知类型信号的基础分',
    ruleName: '未知信号',
    scoreDelta: 5,
  },
  {
    eventType: null,
    keywordJson: ['扩建'],
    ruleCode: 'KEYWORD_EXPAND',
    ruleDescription: '文本中出现扩建',
    ruleName: '关键词：扩建',
    scoreDelta: 15,
  },
  {
    eventType: null,
    keywordJson: ['新增产线'],
    ruleCode: 'KEYWORD_NEW_LINE',
    ruleDescription: '文本中出现新增产线',
    ruleName: '关键词：新增产线',
    scoreDelta: 15,
  },
  {
    eventType: null,
    keywordJson: ['仓储'],
    ruleCode: 'KEYWORD_WAREHOUSE',
    ruleDescription: '文本中出现仓储',
    ruleName: '关键词：仓储',
    scoreDelta: 10,
  },
  {
    eventType: null,
    keywordJson: ['搬迁'],
    ruleCode: 'KEYWORD_RELOCATION',
    ruleDescription: '文本中出现搬迁',
    ruleName: '关键词：搬迁',
    scoreDelta: 20,
  },
  {
    eventType: null,
    keywordJson: ['招聘'],
    ruleCode: 'KEYWORD_RECRUITMENT',
    ruleDescription: '文本中出现招聘',
    ruleName: '关键词：招聘',
    scoreDelta: 10,
  },
];

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function stringifyKeywordJson(value?: null | string[]) {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new LeadScoreRuleValidationError(
      'keywordJson 必须是字符串数组或 null',
    );
  }
  return JSON.stringify(value.map((item) => item.trim()).filter(Boolean));
}

function mapRuleRow(row: any) {
  return {
    createTime: row.createTime || null,
    enabled: Boolean(row.enabled),
    eventType: row.eventType || null,
    keywordJson: parseJsonArray(row.keywordJson),
    ruleCode: row.ruleCode || '',
    ruleDescription: row.ruleDescription || null,
    ruleId: Number(row.ruleId),
    ruleName: row.ruleName || '',
    scoreDelta: Number(row.scoreDelta || 0),
    updateTime: row.updateTime || null,
  };
}

export async function seedDefaultScoreRules() {
  await ensureProfileScoreStorage();

  for (const rule of defaultScoreRules) {
    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO lead_score_rule (
          rule_code, rule_name, event_type, keyword_json, score_delta,
          enabled, rule_description, create_time, update_time
        )
        VALUES (?, ?, ?, ?, ?, 1, ?, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          rule_name = VALUES(rule_name),
          event_type = VALUES(event_type),
          keyword_json = IF(lead_score_rule.keyword_json IS NULL, VALUES(keyword_json), lead_score_rule.keyword_json),
          rule_description = IF(lead_score_rule.rule_description IS NULL, VALUES(rule_description), lead_score_rule.rule_description),
          update_time = NOW(3)
      `,
      rule.ruleCode,
      rule.ruleName,
      rule.eventType,
      rule.keywordJson ? JSON.stringify(rule.keywordJson) : null,
      rule.scoreDelta,
      rule.ruleDescription,
    );
  }
}

export async function listLeadScoreRules() {
  await seedDefaultScoreRules();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(`
    SELECT
      rule_id AS ruleId,
      rule_code AS ruleCode,
      rule_name AS ruleName,
      event_type AS eventType,
      keyword_json AS keywordJson,
      score_delta AS scoreDelta,
      enabled,
      rule_description AS ruleDescription,
      create_time AS createTime,
      update_time AS updateTime
    FROM lead_score_rule
    ORDER BY rule_id ASC
  `);
  return {
    items: rows.map((row) => mapRuleRow(row)),
    total: rows.length,
  };
}

export async function updateLeadScoreRule(
  ruleId: number,
  payload: LeadScoreRuleUpdatePayload,
) {
  await seedDefaultScoreRules();

  const setClauses: string[] = [];
  const setParams: unknown[] = [];
  if (payload.enabled !== undefined) {
    setClauses.push('enabled = ?');
    setParams.push(payload.enabled ? 1 : 0);
  }
  if (payload.scoreDelta !== undefined) {
    const scoreDelta = Number(payload.scoreDelta);
    if (!Number.isFinite(scoreDelta)) {
      throw new LeadScoreRuleValidationError('scoreDelta 无效');
    }
    setClauses.push('score_delta = ?');
    setParams.push(Math.round(scoreDelta));
  }
  if (payload.keywordJson !== undefined) {
    setClauses.push('keyword_json = ?');
    setParams.push(stringifyKeywordJson(payload.keywordJson));
  }
  if (payload.ruleDescription !== undefined) {
    setClauses.push('rule_description = ?');
    setParams.push(payload.ruleDescription || null);
  }

  if (setClauses.length > 0) {
    const affected = await prismaClient.$executeRawUnsafe(
      `
        UPDATE lead_score_rule
        SET ${setClauses.join(', ')}, update_time = NOW(3)
        WHERE rule_id = ?
      `,
      ...setParams,
      ruleId,
    );
    if (Number(affected || 0) === 0) {
      return null;
    }
  }

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        rule_id AS ruleId,
        rule_code AS ruleCode,
        rule_name AS ruleName,
        event_type AS eventType,
        keyword_json AS keywordJson,
        score_delta AS scoreDelta,
        enabled,
        rule_description AS ruleDescription,
        create_time AS createTime,
        update_time AS updateTime
      FROM lead_score_rule
      WHERE rule_id = ?
      LIMIT 1
    `,
    ruleId,
  );
  return rows[0] ? mapRuleRow(rows[0]) : null;
}

export async function getEnabledLeadScoreRules() {
  await seedDefaultScoreRules();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(`
    SELECT
      rule_id AS ruleId,
      rule_code AS ruleCode,
      rule_name AS ruleName,
      event_type AS eventType,
      keyword_json AS keywordJson,
      score_delta AS scoreDelta,
      enabled,
      rule_description AS ruleDescription,
      create_time AS createTime,
      update_time AS updateTime
    FROM lead_score_rule
    WHERE enabled = 1
    ORDER BY rule_id ASC
  `);
  return rows.map((row) => mapRuleRow(row));
}

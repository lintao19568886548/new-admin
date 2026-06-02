import { prismaClient } from '~/utils/db';

import { assertInvestmentRadarTablesReady } from './schema-guard';
import { refreshSignalEventsFromExternalLeads } from './signal-event-repository';

export interface EnterpriseProfileListParams {
  currentPage: number;
  industryName?: string;
  keyword?: string;
  pageSize: number;
  regionCity?: string;
}

export interface EnterpriseProfileRebuildResult {
  createdProfileCount: number;
  createdTagCount: number;
  signalEventCount: number;
  sourceCompanyCount: number;
  updatedProfileCount: number;
  updatedTagCount: number;
}

export interface EnterpriseProfileRebuildOptions {
  skipSignalRebuild?: boolean;
}

const eventTypeLabelMap: Record<string, string> = {
  EIA_EXPAND: '扩产信号',
  FACTORY_RENT_DEMAND: '租厂需求',
  NEWS_EXPAND: '新闻扩张',
  PUBLIC_FACTORY_DEMAND: '公开厂房需求',
  RECRUITMENT_EXPAND: '招聘扩张',
  RELOCATION: '搬迁信号',
  UNKNOWN: '未知信号',
};

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

function toJson(value: unknown) {
  return JSON.stringify(value ?? []);
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function firstNonEmpty<T = string>(values: Array<null | T | undefined>) {
  return (
    values.find(
      (value) => value !== null && value !== undefined && value !== '',
    ) ?? null
  );
}

function inferIndustryName(text: string) {
  if (/电子|半导体|芯片|电路|智能终端/.test(text)) {
    return '电子信息';
  }
  if (/汽车|零部件|新能源车/.test(text)) {
    return '汽车及零部件';
  }
  if (/医药|医疗|生物/.test(text)) {
    return '生物医药';
  }
  if (/仓储|物流|供应链/.test(text)) {
    return '仓储物流';
  }
  if (/机械|装备|制造|产线|扩建|厂房/.test(text)) {
    return '先进制造';
  }
  return null;
}

function calculateCompleteness(profile: {
  address?: null | string;
  companyName?: null | string;
  industryName?: null | string;
  industryTags: string[];
  lastSignalTime?: Date | null | string;
  latestIntentType?: null | string;
  regionCity?: null | string;
  registeredCapital?: null | number;
  signalCount: number;
  unifiedSocialCreditCode?: null | string;
}) {
  const checks = [
    Boolean(profile.companyName),
    Boolean(profile.unifiedSocialCreditCode),
    Boolean(profile.industryName),
    profile.industryTags.length > 0,
    Boolean(profile.regionCity),
    Boolean(profile.address),
    profile.registeredCapital !== null &&
      profile.registeredCapital !== undefined,
    Boolean(profile.lastSignalTime),
    profile.signalCount > 0,
    Boolean(profile.latestIntentType),
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

function mapProfileRow(row: any) {
  return {
    address: row.address || null,
    businessScope: row.businessScope || null,
    companyName: row.companyName || '',
    createTime: row.createTime || null,
    employeeScale: row.employeeScale || null,
    enterpriseId:
      row.enterpriseId === null || row.enterpriseId === undefined
        ? null
        : Number(row.enterpriseId),
    industryName: row.industryName || null,
    industryTags: parseJsonArray(row.industryTagsJson),
    lastSignalTime: row.lastSignalTime || null,
    latestIntentType: row.latestIntentType || null,
    profileCompleteness: Number(row.profileCompleteness || 0),
    profileId: Number(row.profileId),
    regionCity: row.regionCity || null,
    regionDistrict: row.regionDistrict || null,
    regionProvince: row.regionProvince || null,
    registeredCapital: toNullableNumber(row.registeredCapital),
    signalCount: Number(row.signalCount || 0),
    unifiedSocialCreditCode: row.unifiedSocialCreditCode || null,
    updateTime: row.updateTime || null,
  };
}

function mapTagRow(row: any) {
  return {
    companyName: row.companyName || '',
    confidenceScore: Number(row.confidenceScore || 0),
    createTime: row.createTime || null,
    enterpriseId:
      row.enterpriseId === null || row.enterpriseId === undefined
        ? null
        : Number(row.enterpriseId),
    tagId: Number(row.tagId),
    tagName: row.tagName || '',
    tagSource: row.tagSource || '',
    tagType: row.tagType || '',
    updateTime: row.updateTime || null,
  };
}

function mapSignalRow(row: any) {
  return {
    companyName: row.companyName || '',
    confidenceScore: Number(row.confidenceScore || 0),
    eventId: Number(row.eventId),
    eventSummary: row.eventSummary || null,
    eventTime: row.eventTime || null,
    eventTitle: row.eventTitle || '',
    eventType: row.eventType || 'UNKNOWN',
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
  };
}

let profileScoreStorageReady: null | Promise<void> = null;

async function ensureProfileScoreStorageUncached() {
  await assertInvestmentRadarTablesReady([
    'enterprise_profile',
    'enterprise_tag',
    'lead_score_rule',
    'lead_score_breakdown',
  ]);
}

export async function ensureProfileScoreStorage() {
  if (profileScoreStorageReady) {
    return profileScoreStorageReady;
  }

  profileScoreStorageReady = ensureProfileScoreStorageUncached().catch(
    (error) => {
      profileScoreStorageReady = null;
      throw error;
    },
  );

  return profileScoreStorageReady;
}

async function findProfileByCompanyName(companyName: string) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT profile_id AS profileId
      FROM enterprise_profile
      WHERE company_name = ? AND is_deleted = 0
      LIMIT 1
    `,
    companyName,
  );
  return rows[0] ? Number(rows[0].profileId) : null;
}

async function findTag(params: {
  companyName: string;
  tagName: string;
  tagType: string;
}) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT tag_id AS tagId
      FROM enterprise_tag
      WHERE company_name = ? AND tag_type = ? AND tag_name = ?
      LIMIT 1
    `,
    params.companyName,
    params.tagType,
    params.tagName,
  );
  return rows[0] ? Number(rows[0].tagId) : null;
}

async function upsertEnterpriseTag(params: {
  companyName: string;
  confidenceScore: number;
  enterpriseId?: null | number;
  tagName: string;
  tagSource: string;
  tagType: string;
}) {
  const existingTagId = await findTag(params);
  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO enterprise_tag (
        enterprise_id, company_name, tag_type, tag_name, tag_source,
        confidence_score, create_time, update_time, is_deleted
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3), 0)
      ON DUPLICATE KEY UPDATE
        enterprise_id = VALUES(enterprise_id),
        tag_source = VALUES(tag_source),
        confidence_score = VALUES(confidence_score),
        is_deleted = 0,
        update_time = NOW(3)
    `,
    params.enterpriseId || null,
    params.companyName,
    params.tagType,
    params.tagName,
    params.tagSource,
    params.confidenceScore,
  );
  return Boolean(existingTagId);
}

function buildIndustryTags(params: {
  eventTypes: Set<string>;
  industryName?: null | string;
  keywordTags: Set<string>;
}) {
  const tags = new Set<string>();
  if (params.industryName) {
    tags.add(params.industryName);
  }
  for (const eventType of params.eventTypes) {
    const label = eventTypeLabelMap[eventType];
    if (label) {
      tags.add(label);
    }
  }
  for (const tag of params.keywordTags) {
    tags.add(tag);
  }
  return [...tags];
}

export async function refreshEnterpriseProfilesFromSignals(
  options: EnterpriseProfileRebuildOptions = {},
): Promise<EnterpriseProfileRebuildResult> {
  if (!options.skipSignalRebuild) {
    await refreshSignalEventsFromExternalLeads();
  }
  await ensureProfileScoreStorage();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(`
    SELECT
      se.event_id AS eventId,
      se.enterprise_id AS signalEnterpriseId,
      se.company_name AS companyName,
      se.event_type AS eventType,
      se.event_title AS eventTitle,
      se.event_summary AS eventSummary,
      se.event_time AS eventTime,
      se.source_name AS sourceName,
      se.confidence_score AS confidenceScore,
      se.related_radar_lead_id AS relatedRadarLeadId,
      cl.industry_name AS leadIndustryName,
      cl.region_province AS leadRegionProvince,
      cl.region_city AS leadRegionCity,
      cl.region_district AS leadRegionDistrict,
      cl.hit_keywords AS leadHitKeywords,
      ie.enterprise_id AS enterpriseId,
      ie.unified_social_credit_code AS unifiedSocialCreditCode,
      ie.industry_name AS enterpriseIndustryName,
      ie.city AS enterpriseCity,
      ie.address AS enterpriseAddress,
      ie.register_capital AS registeredCapital
    FROM signal_event se
    LEFT JOIN company_lead cl
      ON cl.lead_id = se.related_external_lead_id AND cl.is_deleted = 0
    LEFT JOIN investment_enterprise ie
      ON ie.enterprise_id = se.enterprise_id OR ie.enterprise_name = se.company_name
    WHERE se.is_deleted = 0
    ORDER BY se.company_name ASC, se.event_time DESC, se.event_id DESC
  `);

  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const companyName = normalizeString(row.companyName);
    if (!companyName) {
      continue;
    }
    if (!grouped.has(companyName)) {
      grouped.set(companyName, []);
    }
    const existingEventIds = new Set(
      grouped.get(companyName)?.map((item) => String(item.eventId)) || [],
    );
    if (!existingEventIds.has(String(row.eventId))) {
      grouped.get(companyName)?.push(row);
    }
  }

  let createdProfileCount = 0;
  let updatedProfileCount = 0;
  let createdTagCount = 0;
  let updatedTagCount = 0;

  for (const [companyName, companyRows] of grouped) {
    const latest = companyRows[0];
    const eventTypes = new Set<string>();
    const keywordTags = new Set<string>();
    let maxConfidence = 0;
    for (const row of companyRows) {
      eventTypes.add(row.eventType || 'UNKNOWN');
      maxConfidence = Math.max(maxConfidence, Number(row.confidenceScore || 0));
      for (const keyword of parseJsonArray(row.leadHitKeywords)) {
        keywordTags.add(keyword);
      }
    }

    const text = companyRows
      .map((row) =>
        [row.eventTitle, row.eventSummary, row.leadHitKeywords].join(' '),
      )
      .join(' ');
    const enterpriseId = toNullableNumber(
      firstNonEmpty(
        companyRows.map((row) => row.enterpriseId || row.signalEnterpriseId),
      ),
    );
    const industryName = normalizeString(
      firstNonEmpty(
        companyRows.map(
          (row) => row.leadIndustryName || row.enterpriseIndustryName,
        ),
      ) ||
        inferIndustryName(text) ||
        '',
    );
    const industryTags = buildIndustryTags({
      eventTypes,
      industryName: industryName || null,
      keywordTags,
    });
    const regionProvince = firstNonEmpty(
      companyRows.map((row) => row.leadRegionProvince),
    );
    const regionCity =
      firstNonEmpty(
        companyRows.map((row) => row.leadRegionCity || row.enterpriseCity),
      ) || null;
    const regionDistrict = firstNonEmpty(
      companyRows.map((row) => row.leadRegionDistrict),
    );
    const address =
      firstNonEmpty(companyRows.map((row) => row.enterpriseAddress)) ||
      [regionProvince, regionCity, regionDistrict].filter(Boolean).join(' ') ||
      null;
    const registeredCapital = toNullableNumber(
      firstNonEmpty(companyRows.map((row) => row.registeredCapital)),
    );
    const latestIntentType = latest.eventType || 'UNKNOWN';
    const profileCompleteness = calculateCompleteness({
      address,
      companyName,
      industryName: industryName || null,
      industryTags,
      lastSignalTime: latest.eventTime || null,
      latestIntentType,
      regionCity: regionCity ? String(regionCity) : null,
      registeredCapital,
      signalCount: companyRows.length,
      unifiedSocialCreditCode: firstNonEmpty(
        companyRows.map((row) => row.unifiedSocialCreditCode),
      ) as null | string,
    });
    const existingProfileId = await findProfileByCompanyName(companyName);

    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO enterprise_profile (
          enterprise_id, company_name, unified_social_credit_code,
          industry_name, industry_tags_json, region_province, region_city,
          region_district, registered_capital, employee_scale, business_scope,
          address, last_signal_time, signal_count, latest_intent_type,
          profile_completeness, create_time, update_time, is_deleted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, NOW(3), NOW(3), 0)
        ON DUPLICATE KEY UPDATE
          enterprise_id = VALUES(enterprise_id),
          unified_social_credit_code = VALUES(unified_social_credit_code),
          industry_name = VALUES(industry_name),
          industry_tags_json = VALUES(industry_tags_json),
          region_province = VALUES(region_province),
          region_city = VALUES(region_city),
          region_district = VALUES(region_district),
          registered_capital = VALUES(registered_capital),
          address = VALUES(address),
          last_signal_time = VALUES(last_signal_time),
          signal_count = VALUES(signal_count),
          latest_intent_type = VALUES(latest_intent_type),
          profile_completeness = VALUES(profile_completeness),
          is_deleted = 0,
          update_time = NOW(3)
      `,
      enterpriseId,
      companyName,
      firstNonEmpty(companyRows.map((row) => row.unifiedSocialCreditCode)),
      industryName || null,
      toJson(industryTags),
      regionProvince || null,
      regionCity || null,
      regionDistrict || null,
      registeredCapital,
      address,
      latest.eventTime || null,
      companyRows.length,
      latestIntentType,
      profileCompleteness,
    );

    if (existingProfileId) {
      updatedProfileCount += 1;
    } else {
      createdProfileCount += 1;
    }

    await prismaClient.$executeRawUnsafe(
      `
        UPDATE enterprise_tag
        SET is_deleted = 1, update_time = NOW(3)
        WHERE company_name = ?
      `,
      companyName,
    );

    for (const tagName of industryTags) {
      const existed = await upsertEnterpriseTag({
        companyName,
        confidenceScore: maxConfidence,
        enterpriseId,
        tagName,
        tagSource: 'SIGNAL_EVENT',
        tagType: eventTypeLabelMap[tagName] ? 'INTENT' : 'PROFILE',
      });
      if (existed) {
        updatedTagCount += 1;
      } else {
        createdTagCount += 1;
      }
    }

    for (const eventType of eventTypes) {
      const tagName = eventTypeLabelMap[eventType] || eventType;
      const existed = await upsertEnterpriseTag({
        companyName,
        confidenceScore: maxConfidence,
        enterpriseId,
        tagName,
        tagSource: 'SIGNAL_EVENT',
        tagType: 'INTENT',
      });
      if (existed) {
        updatedTagCount += 1;
      } else {
        createdTagCount += 1;
      }
    }
  }

  return {
    createdProfileCount,
    createdTagCount,
    signalEventCount: rows.length,
    sourceCompanyCount: grouped.size,
    updatedProfileCount,
    updatedTagCount,
  };
}

function buildProfileSelectSql() {
  return `
    SELECT
      profile_id AS profileId,
      enterprise_id AS enterpriseId,
      company_name AS companyName,
      unified_social_credit_code AS unifiedSocialCreditCode,
      industry_name AS industryName,
      industry_tags_json AS industryTagsJson,
      region_province AS regionProvince,
      region_city AS regionCity,
      region_district AS regionDistrict,
      registered_capital AS registeredCapital,
      employee_scale AS employeeScale,
      business_scope AS businessScope,
      address,
      last_signal_time AS lastSignalTime,
      signal_count AS signalCount,
      latest_intent_type AS latestIntentType,
      profile_completeness AS profileCompleteness,
      create_time AS createTime,
      update_time AS updateTime
    FROM enterprise_profile
  `;
}

export async function listEnterpriseProfiles(
  params: EnterpriseProfileListParams,
) {
  await ensureProfileScoreStorage();

  const whereClauses = ['is_deleted = 0'];
  const whereParams: unknown[] = [];
  const appendLike = (sql: string, value?: string) => {
    if (!value) {
      return;
    }
    whereClauses.push(sql);
    whereParams.push(`%${value}%`);
  };

  appendLike('industry_name LIKE ?', params.industryName);
  appendLike('region_city LIKE ?', params.regionCity);
  if (params.keyword) {
    whereClauses.push(
      '(company_name LIKE ? OR industry_name LIKE ? OR region_city LIKE ? OR address LIKE ?)',
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
        FROM enterprise_profile
        ${whereSql}
      `,
      ...whereParams,
    ),
    prismaClient.$queryRawUnsafe<any[]>(
      `
        ${buildProfileSelectSql()}
        ${whereSql}
        ORDER BY last_signal_time DESC, update_time DESC, profile_id DESC
        LIMIT ? OFFSET ?
      `,
      ...whereParams,
      params.pageSize,
      offset,
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map((row) => mapProfileRow(row)),
    page: {
      currentPage: params.currentPage,
      pageSize: params.pageSize,
      total,
    },
    total,
  };
}

export async function getEnterpriseProfileDetail(profileId: number) {
  await ensureProfileScoreStorage();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      ${buildProfileSelectSql()}
      WHERE profile_id = ? AND is_deleted = 0
      LIMIT 1
    `,
    profileId,
  );
  return rows[0] ? mapProfileRow(rows[0]) : null;
}

export async function listEnterpriseProfileSignals(profileId: number) {
  const profile = await getEnterpriseProfileDetail(profileId);
  if (!profile) {
    return null;
  }

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        event_id AS eventId,
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
        related_radar_lead_id AS relatedRadarLeadId
      FROM signal_event
      WHERE company_name = ? AND is_deleted = 0
      ORDER BY event_time DESC, event_id DESC
    `,
    profile.companyName,
  );
  return {
    items: rows.map((row) => mapSignalRow(row)),
    total: rows.length,
  };
}

export async function listEnterpriseProfileTags(profileId: number) {
  const profile = await getEnterpriseProfileDetail(profileId);
  if (!profile) {
    return null;
  }

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        tag_id AS tagId,
        enterprise_id AS enterpriseId,
        company_name AS companyName,
        tag_type AS tagType,
        tag_name AS tagName,
        tag_source AS tagSource,
        confidence_score AS confidenceScore,
        create_time AS createTime,
        update_time AS updateTime
      FROM enterprise_tag
      WHERE company_name = ? AND is_deleted = 0
      ORDER BY tag_type ASC, confidence_score DESC, tag_id ASC
    `,
    profile.companyName,
  );
  return {
    items: rows.map((row) => mapTagRow(row)),
    total: rows.length,
  };
}

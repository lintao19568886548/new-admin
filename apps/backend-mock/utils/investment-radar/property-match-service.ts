import { prismaClient } from '../db';
import { getPropertyTagsByFactoryIds } from './property-tag-service';
import { assertInvestmentRadarTableReady } from './schema-guard';

interface RadarLeadDetail {
  city?: null | string;
  intentArea?: null | number;
  industryName?: null | string;
  parkId?: null | number;
}

interface FactoryMatchSource {
  address?: null | string;
  availableArea: number;
  factoryId: number;
  factoryName: string;
  floorCount: number;
  floorFeatures: string[];
  isOwn?: boolean;
  parkId?: null | number;
  parkName?: null | string;
  rentPrice?: null | number;
  tag?: string;
  totalArea: number;
  usedArea: number;
}

export interface PropertyMatchResult {
  address?: null | string;
  availableArea: number;
  factoryId: number;
  factoryName: string;
  floorCount?: number;
  matchReasons: string[];
  matchScore: number;
  mismatchReminders: string[];
  parkId?: null | number;
  parkName?: null | string;
  rentPrice?: number;
  rentPriceText?: string;
  salesPitch: string;
  tag?: string;
  title?: string;
  totalArea: number;
  usedArea?: number;
}

type PropertyMatchRow = Record<string, unknown> & {
  address?: null | string;
  availableArea?: unknown;
  factoryId?: unknown;
  factoryName?: null | string;
  floorCount?: unknown;
  matchReasonsJson?: null | string;
  matchScore?: unknown;
  mismatchRemindersJson?: null | string;
  parkId?: unknown;
  parkName?: null | string;
  rentPrice?: unknown;
  rentPriceText?: null | string;
  salesPitch?: null | string;
  tag?: null | string;
  totalArea?: unknown;
  usedArea?: unknown;
};

interface MatchScoreResult {
  reasons: string[];
  score: number;
}

interface PropertyMatchOptions {
  authorizedParkIds?: number[];
  includeAllParks?: boolean;
  resultLimit?: number;
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function toNumber(value: unknown) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getIndustryKeywords(industryName?: null | string) {
  const text = String(industryName || '');
  if (!text) {
    return [];
  }
  const keywords = [text];
  if (includesAny(text, ['机械', '装备', '加工', '制造'])) {
    keywords.push('生产', '制造', '加工', '行车', '承重', '三相电');
  }
  if (includesAny(text, ['物流', '仓储', '电商', '供应链'])) {
    keywords.push('仓储', '物流', '层高', '大车', '卸货');
  }
  if (includesAny(text, ['研发', '办公', '科技', '软件'])) {
    keywords.push('研发', '办公', '装修');
  }
  return uniqueValues(keywords);
}

function getAreaMatchLabel(factory: FactoryMatchSource, intentArea: number) {
  if (intentArea <= 0 || factory.availableArea <= 0) {
    return '';
  }

  const ratio = factory.availableArea / intentArea;
  if (ratio >= 0.9 && ratio <= 1.25) {
    return '面积高度贴合';
  }
  if (ratio >= 0.75 && ratio <= 1.5) {
    return '面积区间匹配';
  }
  if (ratio > 1.5) {
    return '面积储备充足';
  }
  return '面积接近需求';
}

export function calculatePropertyMatchScore(
  factory: FactoryMatchSource,
  leadDetail: RadarLeadDetail,
): MatchScoreResult {
  const reasons: string[] = [];
  let score = 50;

  const intentArea = Number(leadDetail.intentArea || 0);
  if (intentArea > 0 && factory.availableArea > 0) {
    const lowerBound = intentArea * 0.8;
    const upperBound = intentArea * 1.5;

    if (
      factory.availableArea >= lowerBound &&
      factory.availableArea <= upperBound
    ) {
      score += 28;
      reasons.push(getAreaMatchLabel(factory, intentArea) || '面积匹配');
    } else if (factory.availableArea >= intentArea * 0.5) {
      score += 14;
      reasons.push(
        factory.availableArea > upperBound ? '面积充裕' : '面积接近',
      );
    }
  }

  if (leadDetail.parkId && factory.parkId === leadDetail.parkId) {
    score += 12;
    reasons.push('同园区');
  } else if (
    leadDetail.city &&
    `${factory.parkName || ''}${factory.address || ''}`.includes(
      leadDetail.city,
    )
  ) {
    score += 8;
    reasons.push('同城区域');
  }

  const searchableText = [
    factory.factoryName,
    factory.address,
    factory.parkName,
    factory.tag,
    ...factory.floorFeatures,
  ]
    .join(' ')
    .toLowerCase();
  const industryKeywords = getIndustryKeywords(leadDetail.industryName);
  if (
    industryKeywords.some((keyword) =>
      searchableText.includes(keyword.toLowerCase()),
    )
  ) {
    score += 10;
    reasons.push('行业/用途匹配');
  }

  if (factory.floorFeatures.length > 0) {
    score += Math.min(factory.floorFeatures.length * 3, 9);
    reasons.push(...factory.floorFeatures.slice(0, 3));
  }

  if (factory.availableArea > 0 && factory.usedArea === 0) {
    score += 6;
    reasons.push('整层/整栋可快速排布');
  }

  if (factory.floorCount <= 2 && factory.availableArea > 0) {
    score += 4;
    reasons.push('楼层使用便利');
  }

  if (factory.rentPrice && factory.rentPrice <= 60) {
    score += 8;
    reasons.push('租金优势明显');
  } else if (factory.rentPrice && factory.rentPrice <= 80) {
    score += 5;
    reasons.push('租金可控');
  }

  if (factory.availableArea <= 0) {
    score = Math.min(score, 40);
  }

  return {
    reasons: uniqueValues(reasons.length > 0 ? reasons : ['可用房源']),
    score: Math.max(0, Math.min(score, 100)),
  };
}

export function generateMismatchReminders(
  factory: FactoryMatchSource,
  leadDetail: RadarLeadDetail,
): string[] {
  const reminders: string[] = [];
  const intentArea = Number(leadDetail.intentArea || 0);

  if (intentArea > 0 && factory.availableArea > 0) {
    if (factory.availableArea < intentArea * 0.8) {
      reminders.push(
        `面积偏小，需求约 ${intentArea.toLocaleString('zh-CN')}m²，可用 ${factory.availableArea.toLocaleString('zh-CN')}m²`,
      );
    } else if (factory.availableArea > intentArea * 1.5) {
      reminders.push(
        `面积偏大，需求约 ${intentArea.toLocaleString('zh-CN')}m²，可用 ${factory.availableArea.toLocaleString('zh-CN')}m²`,
      );
    }
  }

  if (
    leadDetail.parkId &&
    factory.parkId &&
    factory.parkId !== leadDetail.parkId
  ) {
    reminders.push('不在目标园区，可作为备选推荐');
  }

  if (factory.rentPrice && factory.rentPrice > 100) {
    reminders.push('租金偏高，建议先确认预算');
  }
  if (!factory.rentPrice) {
    reminders.push('租金未维护，推荐前需补充报价');
  }

  if (factory.availableArea <= 0) {
    reminders.push('当前无明确空置面积');
  }
  if (factory.floorFeatures.length === 0) {
    reminders.push('房源亮点不足，建议补充层高、承重、用电等信息');
  }

  return reminders;
}

export function generateSalesPitch(
  factory: FactoryMatchSource,
  leadDetail: RadarLeadDetail,
  matchScore: number,
) {
  const parts = [`可向客户推荐 ${factory.factoryName}`];
  const intentArea = Number(leadDetail.intentArea || 0);

  if (factory.parkName) {
    parts.push(`位于 ${factory.parkName}`);
  }
  if (intentArea > 0 && factory.availableArea > 0) {
    parts.push(
      `可用面积约 ${factory.availableArea.toLocaleString('zh-CN')}m²，客户需求约 ${intentArea.toLocaleString('zh-CN')}m²`,
    );
  } else if (factory.availableArea > 0) {
    parts.push(`可用面积约 ${factory.availableArea.toLocaleString('zh-CN')}m²`);
  }
  if (factory.floorFeatures.length > 0) {
    parts.push(`亮点是 ${factory.floorFeatures.slice(0, 2).join('、')}`);
  } else {
    parts.push('建议补充层高、承重、用电等参数后再深度推荐');
  }
  if (factory.rentPrice) {
    parts.push(`租金约 ${factory.rentPrice.toLocaleString('zh-CN')}元/m²/月`);
  }
  parts.push(matchScore >= 80 ? '建议优先邀约看房' : '建议作为备选方案沟通');

  return `${parts.join('，')}。`;
}

function buildFloorFeatures(
  factoryDescription: null | string | undefined,
  floors: Array<{
    description?: null | string;
    floorHeight?: unknown;
    loadBearing?: unknown;
    status?: null | string;
  }>,
) {
  const features: string[] = [];
  const text = [
    factoryDescription || '',
    ...floors.map((floor) => floor.description || ''),
  ].join(' ');

  if (floors.some((floor) => toNumber(floor.floorHeight) >= 6)) {
    features.push('层高较高');
  }
  if (floors.some((floor) => toNumber(floor.loadBearing) >= 1)) {
    features.push('承重较好');
  }
  if (floors.some((floor) => String(floor.status || '').includes('空'))) {
    features.push('可快速入驻');
  }
  if (text.includes('行车')) {
    features.push('带行车');
  }
  if (text.includes('三相电')) {
    features.push('三相电');
  }
  if (includesAny(text, ['仓储', '物流'])) {
    features.push('适合仓储');
  }
  if (includesAny(text, ['生产', '加工', '制造'])) {
    features.push('适合生产');
  }
  if (includesAny(text, ['办公', '研发'])) {
    features.push('适合研发办公');
  }

  return uniqueValues(features);
}

export async function ensurePropertyMatchResultTable() {
  await assertInvestmentRadarTableReady('property_match_result');
}

function isMatchVisibleToUser(
  match: PropertyMatchResult,
  authorizedParkIds: number[],
) {
  if (authorizedParkIds.length === 0) {
    return match.parkId === null || match.parkId === undefined;
  }
  return (
    match.parkId === null ||
    match.parkId === undefined ||
    authorizedParkIds.includes(Number(match.parkId))
  );
}

function mapPropertyMatchRow(row: PropertyMatchRow): PropertyMatchResult {
  const parkId = toNullableNumber(row.parkId);
  const rentPrice = toNullableNumber(row.rentPrice);
  const usedArea = toNullableNumber(row.usedArea);

  return {
    address: row.address || null,
    availableArea: toNumber(row.availableArea),
    factoryId: toNumber(row.factoryId),
    factoryName: row.factoryName || '未命名房源',
    floorCount: toNullableNumber(row.floorCount),
    matchReasons: parseStringArray(row.matchReasonsJson),
    matchScore: toNumber(row.matchScore),
    mismatchReminders: parseStringArray(row.mismatchRemindersJson),
    parkId,
    parkName: row.parkName || null,
    rentPrice,
    rentPriceText: row.rentPriceText || undefined,
    salesPitch: row.salesPitch || '',
    tag: row.tag || undefined,
    title: row.factoryName || undefined,
    totalArea: toNumber(row.totalArea),
    usedArea,
  };
}

export async function listSavedPropertyMatches(
  leadId: number,
  options: PropertyMatchOptions = {},
): Promise<PropertyMatchResult[]> {
  await ensurePropertyMatchResultTable();

  const rows = await prismaClient.$queryRawUnsafe<PropertyMatchRow[]>(
    `
      SELECT
        factory_id AS factoryId,
        park_id AS parkId,
        factory_name AS factoryName,
        park_name AS parkName,
        address,
        match_score AS matchScore,
        available_area AS availableArea,
        total_area AS totalArea,
        used_area AS usedArea,
        rent_price AS rentPrice,
        rent_price_text AS rentPriceText,
        floor_count AS floorCount,
        tag,
        match_reasons_json AS matchReasonsJson,
        mismatch_reminders_json AS mismatchRemindersJson,
        sales_pitch AS salesPitch
      FROM property_match_result
      WHERE lead_id = ?
      ORDER BY match_score DESC, computed_at DESC, match_id ASC
      LIMIT 50
    `,
    leadId,
  );

  const authorizedParkIds = options.authorizedParkIds || [];
  return rows
    .map((row) => mapPropertyMatchRow(row))
    .filter((item) => isMatchVisibleToUser(item, authorizedParkIds))
    .slice(0, 10);
}

async function hasSavedPropertyMatches(leadId: number) {
  await ensurePropertyMatchResultTable();

  const rows = await prismaClient.$queryRawUnsafe<Array<{ total: unknown }>>(
    `
      SELECT COUNT(*) AS total
      FROM property_match_result
      WHERE lead_id = ?
    `,
    leadId,
  );

  return toNumber(rows[0]?.total) > 0;
}

export async function replacePropertyMatchResults(
  leadId: number,
  matches: PropertyMatchResult[],
) {
  await ensurePropertyMatchResultTable();

  await prismaClient.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `DELETE FROM property_match_result WHERE lead_id = ?`,
      leadId,
    );

    for (const match of matches) {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO property_match_result
            (
              lead_id, factory_id, park_id, factory_name, park_name, address,
              match_score, available_area, total_area, used_area, rent_price,
              rent_price_text, floor_count, tag, match_reasons_json,
              mismatch_reminders_json, sales_pitch, snapshot_json,
              computed_at, create_time, update_time
            )
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
        `,
        leadId,
        match.factoryId,
        match.parkId ?? null,
        match.factoryName || '未命名房源',
        match.parkName || null,
        match.address || null,
        match.matchScore,
        match.availableArea,
        match.totalArea,
        match.usedArea ?? null,
        match.rentPrice ?? null,
        match.rentPriceText || null,
        match.floorCount ?? null,
        match.tag || null,
        JSON.stringify(match.matchReasons || []),
        JSON.stringify(match.mismatchReminders || []),
        match.salesPitch || null,
        JSON.stringify(match),
      );
    }
  });
}

export async function performPropertyMatch(
  leadId: number,
  options: PropertyMatchOptions = {},
): Promise<PropertyMatchResult[]> {
  try {
    const leadRows = await prismaClient.$queryRawUnsafe<any[]>(
      `
        SELECT
          l.intent_area AS intentArea,
          l.park_id AS parkId,
          e.industry_name AS industryName,
          e.city AS city
        FROM investment_lead l
        LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
        WHERE l.lead_id = ? AND l.is_deleted = 0
        LIMIT 1
      `,
      leadId,
    );

    const lead = leadRows[0] || null;
    if (!lead) {
      return [];
    }

    const authorizedParkIds = options.authorizedParkIds || [];
    let factoryWhere;
    if (options.includeAllParks) {
      factoryWhere = {
        isDeleted: false,
        OR: [{ isOwn: true }, { isOwn: false, parkId: null }],
      };
    } else if (authorizedParkIds.length > 0) {
      factoryWhere = {
        isDeleted: false,
        OR: [
          { isOwn: true, parkId: { in: authorizedParkIds } },
          { isOwn: false, parkId: null },
        ],
      };
    } else {
      factoryWhere = {
        isDeleted: false,
        isOwn: false,
        parkId: null,
      };
    }

    const factories = await prismaClient.factory.findMany({
      include: {
        floors: {
          orderBy: { createTime: 'desc' },
          select: {
            description: true,
            floorHeight: true,
            loadBearing: true,
            rentPrice: true,
            status: true,
            totalArea: true,
            usedArea: true,
          },
          where: { isDeleted: false },
        },
        park: {
          select: {
            parkId: true,
            parkName: true,
          },
        },
      },
      orderBy: { createTime: 'desc' },
      take: 50,
      where: factoryWhere,
    });

    const leadInfo: RadarLeadDetail = {
      city: lead.city,
      industryName: lead.industryName,
      intentArea:
        lead.intentArea === null || lead.intentArea === undefined
          ? null
          : toNumber(lead.intentArea),
      parkId:
        lead.parkId === null || lead.parkId === undefined
          ? null
          : Number(lead.parkId),
    };

    const tagsByFactoryId = await getPropertyTagsByFactoryIds(
      factories.map((factory) => factory.factoryId),
    );

    return factories
      .map((factory) => {
        const floors = factory.floors || [];
        const totalArea = floors.reduce(
          (sum, floor) => sum + toNumber(floor.totalArea),
          0,
        );
        const usedArea = floors.reduce(
          (sum, floor) => sum + toNumber(floor.usedArea),
          0,
        );
        const availableArea = Math.max(totalArea - usedArea, 0);
        const rentPrices = floors
          .map((floor) => toNumber(floor.rentPrice))
          .filter((price) => price > 0);
        const rentPrice =
          rentPrices.length > 0 ? Math.min(...rentPrices) : undefined;
        const propertyTags = tagsByFactoryId.get(factory.factoryId) || [];
        const floorFeatures = uniqueValues([
          ...buildFloorFeatures(factory.description, floors),
          ...propertyTags,
        ]);
        const source: FactoryMatchSource = {
          address: factory.address,
          availableArea,
          factoryId: factory.factoryId,
          factoryName: factory.factoryName,
          floorCount: floors.length,
          floorFeatures,
          isOwn: factory.isOwn,
          parkId: factory.parkId,
          parkName:
            factory.park?.parkName || (factory.isOwn ? null : '入驻厂房'),
          rentPrice,
          tag: propertyTags[0] || (factory.isOwn ? '自有厂房' : '入驻厂房'),
          totalArea,
          usedArea,
        };
        const scoreResult = calculatePropertyMatchScore(source, leadInfo);

        return {
          address: source.address,
          availableArea: source.availableArea,
          factoryId: source.factoryId,
          factoryName: source.factoryName,
          floorCount: source.floorCount,
          matchReasons: scoreResult.reasons,
          matchScore: scoreResult.score,
          mismatchReminders: generateMismatchReminders(source, leadInfo),
          parkId: source.parkId,
          parkName: source.parkName,
          rentPrice: source.rentPrice,
          rentPriceText: source.rentPrice
            ? `${source.rentPrice.toLocaleString('zh-CN')}元/m²/月起`
            : undefined,
          salesPitch: generateSalesPitch(source, leadInfo, scoreResult.score),
          tag: source.tag,
          title: source.factoryName,
          totalArea: source.totalArea,
          usedArea: source.usedArea,
        };
      })
      .filter((item) => item.totalArea > 0 || item.availableArea > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, options.resultLimit ?? 10);
  } catch (error) {
    console.error('Property match failed:', error);
    return [];
  }
}

async function rebuildPropertyMatchSnapshot(leadId: number) {
  const matches = await performPropertyMatch(leadId, {
    includeAllParks: true,
    resultLimit: 50,
  });
  await replacePropertyMatchResults(leadId, matches);
  return matches;
}

function filterVisiblePropertyMatches(
  matches: PropertyMatchResult[],
  options: PropertyMatchOptions = {},
) {
  const authorizedParkIds = options.authorizedParkIds || [];
  return matches
    .filter((item) => isMatchVisibleToUser(item, authorizedParkIds))
    .slice(0, 10);
}

export async function rebuildPropertyMatches(
  leadId: number,
  options: PropertyMatchOptions = {},
) {
  const matches = await rebuildPropertyMatchSnapshot(leadId);
  return filterVisiblePropertyMatches(matches, options);
}

export async function rebuildVisiblePropertyMatches(
  leadId: number,
  options: PropertyMatchOptions = {},
) {
  const matches = await performPropertyMatch(leadId, options);
  return matches;
}

export async function rebuildPropertyMatchesForLeads(limit = 200) {
  await ensurePropertyMatchResultTable();

  const rows = await prismaClient.$queryRawUnsafe<Array<{ leadId: unknown }>>(
    `
      SELECT l.lead_id AS leadId
      FROM investment_lead l
      WHERE l.is_deleted = 0
        AND l.stage NOT IN ('CLOSED', 'DEAL', 'INVALID')
      ORDER BY
        CASE l.priority_level
          WHEN 'A' THEN 0
          WHEN 'B' THEN 1
          ELSE 2
        END,
        l.total_score DESC,
        l.update_time DESC
      LIMIT ?
    `,
    Math.max(1, Math.min(1000, Number(limit || 200))),
  );

  const items: Array<{
    leadId: number;
    matchCount: number;
    topMatchScore: number;
  }> = [];

  for (const row of rows) {
    const leadId = toNumber(row.leadId);
    if (leadId <= 0) {
      continue;
    }
    const matches = await rebuildPropertyMatchSnapshot(leadId);
    items.push({
      leadId,
      matchCount: matches.length,
      topMatchScore: matches[0]?.matchScore || 0,
    });
  }

  return {
    items,
    rebuiltAt: new Date().toISOString(),
    rebuiltLeadCount: items.length,
  };
}

export async function getSavedOrBuildPropertyMatches(
  leadId: number,
  options: PropertyMatchOptions = {},
) {
  if (!(await hasSavedPropertyMatches(leadId))) {
    await rebuildPropertyMatchSnapshot(leadId);
  }
  return listSavedPropertyMatches(leadId, options);
}

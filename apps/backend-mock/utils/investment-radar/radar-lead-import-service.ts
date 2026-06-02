import { prismaClient } from '~/utils/db';

import { assertInvestmentRadarTablesReady } from './schema-guard';

export interface RadarLeadImportFailItem {
  enterpriseName?: null | string;
  error: string;
  index?: number;
  rawData?: Record<string, unknown>;
  rowNumber?: number;
}

export interface RadarLeadImportResult {
  failItems: RadarLeadImportFailItem[];
  success: number;
}

interface NormalizedRadarLeadImportItem {
  address?: null | string;
  city?: null | string;
  contactName?: null | string;
  enterpriseName: string;
  industryName?: null | string;
  intentArea?: null | number;
  intentScore: number;
  leadSource: string;
  matchScore: number;
  ownerUserId?: null | number;
  parkId?: null | number;
  phoneNumber?: null | string;
  priorityLevel: string;
  reachableScore: number;
  registerCapital?: null | number;
  sourceLatest: string;
  stage: string;
  stageExplicit: boolean;
  totalScore: number;
  unifiedSocialCreditCode?: null | string;
}

const tableColumnCache = new Map<string, Promise<Set<string>>>();
let radarLeadCoreStorageReady: null | Promise<void> = null;

function normalizeString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const text =
    typeof value === 'string'
      ? value.replaceAll(',', '').replaceAll(/[^\d.-]/g, '')
      : value;
  const numericValue = Number(text);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function ensureColumnExists(params: {
  columnDefinition: string;
  columnName: string;
  tableName: string;
}) {
  const rows = await prismaClient.$queryRawUnsafe<Array<{ total: any }>>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    params.tableName,
    params.columnName,
  );
  if (Number(rows[0]?.total || 0) > 0) {
    return;
  }
  await prismaClient.$executeRawUnsafe(
    `ALTER TABLE ${params.tableName} ADD COLUMN ${params.columnDefinition}`,
  );
}

export async function ensureRadarLeadCoreStorage() {
  if (radarLeadCoreStorageReady) {
    return radarLeadCoreStorageReady;
  }

  radarLeadCoreStorageReady = (async () => {
    await assertInvestmentRadarTablesReady([
      'investment_enterprise',
      'investment_lead',
    ]);

    await ensureColumnExists({
      columnDefinition: 'latest_task_id VARCHAR(100) NULL',
      columnName: 'latest_task_id',
      tableName: 'investment_lead',
    });
    await ensureColumnExists({
      columnDefinition: 'register_capital DECIMAL(18, 2) NULL',
      columnName: 'register_capital',
      tableName: 'investment_enterprise',
    });

    tableColumnCache.delete('investment_enterprise');
    tableColumnCache.delete('investment_lead');
  })().catch((error) => {
    radarLeadCoreStorageReady = null;
    throw error;
  });

  return radarLeadCoreStorageReady;
}

function pickValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (
      record[key] !== undefined &&
      record[key] !== null &&
      record[key] !== ''
    ) {
      return record[key];
    }
  }
  return null;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  return normalizeString(pickValue(record, keys));
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  return normalizeNumber(pickValue(record, keys));
}

function normalizeStage(value: unknown) {
  const stage = normalizeString(value)?.toUpperCase();
  const allowedStages = new Set([
    'CONTACTED',
    'DEAL',
    'INVALID',
    'NEW',
    'PENDING_CONTACT',
    'REPLIED',
    'VISIT',
  ]);
  return stage && allowedStages.has(stage) ? stage : 'NEW';
}

function normalizePriorityLevel(value: unknown, totalScore: number) {
  const priority = normalizeString(value)?.toUpperCase();
  if (priority && ['A', 'B', 'C'].includes(priority)) {
    return priority;
  }
  if (totalScore >= 80) {
    return 'A';
  }
  if (totalScore >= 60) {
    return 'B';
  }
  return 'C';
}

function normalizeImportItem(
  raw: Record<string, unknown>,
): NormalizedRadarLeadImportItem {
  const enterpriseName = pickString(raw, [
    'enterpriseName',
    'companyName',
    'tenantName',
    '企业名称',
    '公司名称',
    '租户名称',
    '客户名称',
  ]);
  if (!enterpriseName) {
    throw new Error('企业名称不能为空');
  }

  const intentScore = clampScore(
    pickNumber(raw, ['intentScore', '意图分', '意向分']) ?? 60,
  );
  const matchScore = clampScore(
    pickNumber(raw, ['matchScore', '匹配分', '房源匹配分']) ?? 0,
  );
  const reachableScore = clampScore(
    pickNumber(raw, ['reachableScore', '可触达分', '触达分']) ?? 40,
  );
  const explicitTotalScore = pickNumber(raw, ['totalScore', '总分']);
  const totalScore = clampScore(
    explicitTotalScore ??
      intentScore * 0.6 + matchScore * 0.25 + reachableScore * 0.15,
  );
  const stageValue = pickValue(raw, ['stage', '阶段', '当前阶段']);

  return {
    address: pickString(raw, ['address', '地址']),
    city: pickString(raw, ['city', 'regionCity', '城市', '所在城市']),
    contactName: pickString(raw, ['contactName', 'contact', '联系人']),
    enterpriseName,
    industryName: pickString(raw, ['industryName', 'industry', '行业']),
    intentArea: pickNumber(raw, ['intentArea', 'area', '需求面积', '意向面积']),
    intentScore,
    leadSource:
      pickString(raw, ['leadSource', 'source', '来源']) || 'MANUAL_IMPORT',
    matchScore,
    ownerUserId: pickNumber(raw, ['ownerUserId', '负责人ID']),
    parkId: pickNumber(raw, ['parkId', '园区ID']),
    phoneNumber: pickString(raw, [
      'phoneNumber',
      'phone',
      'mobile',
      '联系电话',
      '电话',
      '手机号',
    ]),
    priorityLevel: normalizePriorityLevel(
      pickValue(raw, ['priorityLevel', '优先级']),
      totalScore,
    ),
    reachableScore,
    registerCapital: pickNumber(raw, [
      'registerCapital',
      'registeredCapital',
      '注册资本',
    ]),
    sourceLatest:
      pickString(raw, ['sourceLatest', 'latestSignalType', '最近信号']) ||
      'MANUAL_IMPORT',
    stage: normalizeStage(stageValue),
    stageExplicit: Boolean(normalizeString(stageValue)),
    totalScore,
    unifiedSocialCreditCode: pickString(raw, [
      'unifiedSocialCreditCode',
      'creditCode',
      '统一社会信用代码',
    ]),
  };
}

async function getTableColumns(tableName: string) {
  if (!tableColumnCache.has(tableName)) {
    tableColumnCache.set(
      tableName,
      prismaClient
        .$queryRawUnsafe<Array<{ columnName: string }>>(
          `
            SELECT COLUMN_NAME AS columnName
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
          `,
          tableName,
        )
        .then((rows) => new Set(rows.map((row) => row.columnName))),
    );
  }
  const cachedColumns = tableColumnCache.get(tableName);
  if (cachedColumns) {
    return cachedColumns;
  }
  throw new Error(`table column cache missing: ${tableName}`);
}

function pickExistingColumns(
  columns: Set<string>,
  values: Record<string, unknown>,
) {
  return Object.keys(values).filter((column) => columns.has(column));
}

async function findEnterpriseIdByName(
  columns: Set<string>,
  enterpriseName: string,
) {
  const rows = await prismaClient.$queryRawUnsafe<Array<{ enterpriseId: any }>>(
    `
      SELECT enterprise_id AS enterpriseId
      FROM investment_enterprise
      WHERE enterprise_name = ?
        ${columns.has('is_deleted') ? 'AND is_deleted = 0' : ''}
      ORDER BY enterprise_id DESC
      LIMIT 1
    `,
    enterpriseName,
  );
  return rows[0] ? Number(rows[0].enterpriseId) : null;
}

async function upsertEnterprise(input: NormalizedRadarLeadImportItem) {
  const columns = await getTableColumns('investment_enterprise');
  const enterpriseId = await findEnterpriseIdByName(
    columns,
    input.enterpriseName,
  );
  const now = new Date();
  const insertValues: Record<string, unknown> = {
    address: input.address || '',
    city: input.city,
    contact_name: input.contactName,
    create_time: now,
    enterprise_name: input.enterpriseName,
    industry_name: input.industryName,
    is_deleted: 0,
    last_signal_time: now,
    phone_number: input.phoneNumber,
    register_capital: input.registerCapital,
    source_first: input.leadSource,
    source_latest: input.sourceLatest,
    unified_social_credit_code: input.unifiedSocialCreditCode,
    update_time: now,
  };

  if (enterpriseId) {
    const updateValues: Record<string, unknown> = {
      address: input.address,
      city: input.city,
      contact_name: input.contactName,
      industry_name: input.industryName,
      last_signal_time: now,
      phone_number: input.phoneNumber,
      register_capital: input.registerCapital,
      source_latest: input.sourceLatest,
      unified_social_credit_code: input.unifiedSocialCreditCode,
      update_time: now,
    };
    const updateColumns = pickExistingColumns(columns, updateValues).filter(
      (column) => updateValues[column] !== null && updateValues[column] !== '',
    );
    if (updateColumns.length > 0) {
      await prismaClient.$executeRawUnsafe(
        `
          UPDATE investment_enterprise
          SET ${updateColumns.map((column) => `${column} = ?`).join(', ')}
          WHERE enterprise_id = ?
        `,
        ...updateColumns.map((column) => updateValues[column]),
        enterpriseId,
      );
    }
    return enterpriseId;
  }

  const insertColumns = pickExistingColumns(columns, insertValues);
  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_enterprise
        (${insertColumns.join(', ')})
      VALUES
        (${insertColumns.map(() => '?').join(', ')})
    `,
    ...insertColumns.map((column) => insertValues[column]),
  );
  const insertedEnterpriseId = await findEnterpriseIdByName(
    columns,
    input.enterpriseName,
  );
  return insertedEnterpriseId || 0;
}

async function findRadarLeadIdByEnterprise(enterpriseId: number) {
  const rows = await prismaClient.$queryRawUnsafe<Array<{ leadId: any }>>(
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

async function upsertRadarLead(
  enterpriseId: number,
  input: NormalizedRadarLeadImportItem,
) {
  const columns = await getTableColumns('investment_lead');
  const leadId = await findRadarLeadIdByEnterprise(enterpriseId);
  const now = new Date();
  const values: Record<string, unknown> = {
    create_time: now,
    enterprise_id: enterpriseId,
    intent_area: input.intentArea,
    intent_score: input.intentScore,
    invalid_reason: null,
    is_deleted: 0,
    latest_contact_time: null,
    lead_source: input.leadSource,
    match_score: input.matchScore,
    owner_user_id: input.ownerUserId,
    park_id: input.parkId,
    priority_level: input.priorityLevel,
    reachable_score: input.reachableScore,
    stage: input.stage,
    total_score: input.totalScore,
    update_time: now,
  };

  if (leadId) {
    const updateValues: Record<string, unknown> = {
      intent_area: input.intentArea,
      intent_score: input.intentScore,
      lead_source: input.leadSource,
      match_score: input.matchScore,
      owner_user_id: input.ownerUserId,
      park_id: input.parkId,
      priority_level: input.priorityLevel,
      reachable_score: input.reachableScore,
      total_score: input.totalScore,
      update_time: now,
      ...(input.stageExplicit ? { stage: input.stage } : {}),
    };
    const updateColumns = pickExistingColumns(columns, updateValues).filter(
      (column) => updateValues[column] !== null,
    );
    if (updateColumns.length > 0) {
      await prismaClient.$executeRawUnsafe(
        `
          UPDATE investment_lead
          SET ${updateColumns.map((column) => `${column} = ?`).join(', ')}
          WHERE lead_id = ?
        `,
        ...updateColumns.map((column) => updateValues[column]),
        leadId,
      );
    }
    return leadId;
  }

  const insertColumns = pickExistingColumns(columns, values);
  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_lead
        (${insertColumns.join(', ')})
      VALUES
        (${insertColumns.map(() => '?').join(', ')})
    `,
    ...insertColumns.map((column) => values[column]),
  );
  return (await findRadarLeadIdByEnterprise(enterpriseId)) || 0;
}

export async function importRadarLeadsFromItems(
  items: Record<string, unknown>[],
): Promise<RadarLeadImportResult> {
  await ensureRadarLeadCoreStorage();

  const failItems: RadarLeadImportFailItem[] = [];
  let success = 0;

  for (const [index, rawItem] of items.entries()) {
    try {
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
        throw new Error('导入项必须是对象');
      }
      const normalized = normalizeImportItem(rawItem);
      const enterpriseId = await upsertEnterprise(normalized);
      if (!enterpriseId) {
        throw new Error('企业入库失败');
      }
      const leadId = await upsertRadarLead(enterpriseId, normalized);
      if (!leadId) {
        throw new Error('雷达潜客入库失败');
      }
      success += 1;
    } catch (error) {
      failItems.push({
        enterpriseName:
          normalizeString(
            (rawItem as Record<string, unknown>)?.enterpriseName ||
              (rawItem as Record<string, unknown>)?.companyName ||
              (rawItem as Record<string, unknown>)?.['企业名称'],
          ) || null,
        error: error instanceof Error ? error.message : String(error),
        index,
        rawData:
          rawItem && typeof rawItem === 'object' && !Array.isArray(rawItem)
            ? rawItem
            : { value: rawItem },
        rowNumber: index + 1,
      });
    }
  }

  return {
    failItems,
    success,
  };
}

function parseCsvLine(line: string, separator: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];
    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === separator && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseDelimitedText(text: string) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const separator =
    (lines[0].match(/\t/g) || []).length > (lines[0].match(/,/g) || []).length
      ? '\t'
      : ',';
  const headers = parseCsvLine(lines[0], separator).map((header) =>
    header.trim(),
  );
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, separator);
    const item: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (header) {
        item[header] = values[index] ?? '';
      }
    });
    return item;
  });
}

export function parseRadarLeadImportFile(filename: string, data: Buffer) {
  const text = data.toString('utf8').trim();
  if (!text) {
    return [];
  }
  if (
    /\.json$/i.test(filename) ||
    text.startsWith('[') ||
    text.startsWith('{')
  ) {
    const parsed = JSON.parse(text) as unknown;
    let items: unknown = null;
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as any).items)
    ) {
      items = (parsed as any).items;
    }
    if (!Array.isArray(items)) {
      throw new TypeError('JSON 文件必须是数组或 { items: [] }');
    }
    return items as Record<string, unknown>[];
  }
  return parseDelimitedText(text);
}

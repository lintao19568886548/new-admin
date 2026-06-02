import { prismaClient } from '../db';
import { assertInvestmentRadarTablesReady } from './schema-guard';

export interface OutreachTemplateInput {
  channel: string;
  content: string;
  placeholderJson?: string | string[];
  priorityLevel: string;
  taskType: string;
  templateCode: string;
  templateName: string;
}

export interface OutreachTemplatePreviewInput extends OutreachTemplateInput {
  sampleData?: Record<string, string>;
}

export interface OutreachTemplateListParams {
  approvalStatus?: string;
  channel?: string;
  currentPage?: number;
  enabled?: boolean | string;
  keyword?: string;
  pageSize?: number;
  taskType?: string;
}

export interface OutreachTemplateRow {
  approvalStatus: string;
  channel: string;
  content: string;
  createTime?: null | string;
  enabled: boolean;
  placeholderJson: string[];
  priorityLevel: string;
  taskType: string;
  templateCode: string;
  templateId: number;
  templateName: string;
  updateTime?: null | string;
  versionNo: number;
}

export interface OutreachTemplateVersionRow extends OutreachTemplateRow {
  changeType: string;
  versionId: number;
}

export interface OutreachTemplateStatsRow {
  failedTasks: number;
  negativeReplies: number;
  positiveReplies: number;
  sentTasks: number;
  templateCode: string;
  templateId: number;
  templateName: string;
  totalTasks: number;
}

export const DEFAULT_OUTREACH_TEMPLATES: OutreachTemplateInput[] = [
  {
    channel: 'SMS',
    content:
      '您好，{companyName}近期有{intentArea}厂房需求，我们在{parkName}有匹配房源，可安排专人对接。',
    placeholderJson: ['companyName', 'parkName', 'intentArea'],
    priorityLevel: 'A',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_A_SMS',
    templateName: 'A级线索短信首触达',
  },
  {
    channel: 'CALL',
    content:
      '电话确认{companyName}的面积、层高、用电和入驻时间，优先推荐{parkName}现有空置房源。',
    placeholderJson: ['companyName', 'parkName'],
    priorityLevel: 'A',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_A_CALL',
    templateName: 'A级线索电话外呼',
  },
  {
    channel: 'SMS',
    content:
      '您好，关注到贵司可能有扩产或租赁需求，我们可提供{parkName}可租厂房清单供参考。',
    placeholderJson: ['companyName', 'parkName'],
    priorityLevel: 'B',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_B_SMS',
    templateName: 'B级线索短信培育',
  },
  {
    channel: 'WECHAT',
    content:
      '补充核实{companyName}的具体需求和时间窗口，确认后进入正式招商跟进。',
    placeholderJson: ['companyName', 'parkName'],
    priorityLevel: 'C',
    taskType: 'FOLLOW_UP',
    templateCode: 'RADAR_C_WECHAT',
    templateName: 'C级线索微信跟进',
  },
];

function normalizeTemplateText(value: unknown) {
  return String(value || '').trim();
}

function normalizePlaceholderJson(value: unknown): string {
  if (Array.isArray(value)) {
    return JSON.stringify(
      value.map((item) => normalizeTemplateText(item)).filter(Boolean),
    );
  }

  const text = normalizeTemplateText(value);
  if (!text) {
    return '[]';
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return JSON.stringify(
        parsed.map((item) => normalizeTemplateText(item)).filter(Boolean),
      );
    }
  } catch {
    // Comma-separated text is accepted for quick operations.
  }

  return JSON.stringify(
    text
      .split(',')
      .map((item) => normalizeTemplateText(item))
      .filter(Boolean),
  );
}

function parsePlaceholderJson(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeTemplateText(item)).filter(Boolean);
  }

  const text = normalizeTemplateText(value);
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed)
      ? parsed.map((item) => normalizeTemplateText(item)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function assertTemplateInput(input: OutreachTemplateInput) {
  if (!normalizeTemplateText(input.templateCode)) {
    throw new Error('templateCode 不能为空');
  }
  if (!normalizeTemplateText(input.templateName)) {
    throw new Error('templateName 不能为空');
  }
  if (!normalizeTemplateText(input.content)) {
    throw new Error('content 不能为空');
  }
}

async function executeIgnoreDuplicate(sql: string) {
  try {
    await prismaClient.$executeRawUnsafe(sql);
  } catch (error) {
    const message = String((error as Error)?.message || error || '');
    if (
      !message.includes('Duplicate column') &&
      !message.includes('Duplicate key name')
    ) {
      throw error;
    }
  }
}

function serializeTemplateRow(row: any): OutreachTemplateRow {
  return {
    approvalStatus: row.approvalStatus || 'APPROVED',
    channel: row.channel || '',
    content: row.content || '',
    createTime: row.createTime || null,
    enabled: Boolean(Number(row.enabled ?? 0)),
    placeholderJson: parsePlaceholderJson(row.placeholderJson),
    priorityLevel: row.priorityLevel || '',
    taskType: row.taskType || '',
    templateCode: row.templateCode || '',
    templateId: Number(row.templateId || 0),
    templateName: row.templateName || '',
    updateTime: row.updateTime || null,
    versionNo: Number(row.versionNo || 1),
  };
}

async function findOutreachTemplateById(templateId: number) {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        template_id AS templateId,
        template_code AS templateCode,
        template_name AS templateName,
        task_type AS taskType,
        channel,
        priority_level AS priorityLevel,
        content,
        placeholder_json AS placeholderJson,
        enabled,
        approval_status AS approvalStatus,
        version_no AS versionNo,
        create_time AS createTime,
        update_time AS updateTime
      FROM investment_outreach_template
      WHERE template_id = ?
      LIMIT 1
    `,
    templateId,
  );

  return rows[0] ? serializeTemplateRow(rows[0]) : null;
}

export function fillOutreachTemplateContent(
  content: string,
  data: Record<string, string>,
) {
  return content.replaceAll(/\{(\w+)\}/g, (_, key: string) => data[key] || '-');
}

export function previewOutreachTemplate(input: OutreachTemplatePreviewInput) {
  const placeholders = parsePlaceholderJson(input.placeholderJson);
  const sampleData = input.sampleData || {};
  const usedPlaceholders = [
    ...new Set(
      [...input.content.matchAll(/\{(\w+)\}/g)]
        .map((item) => normalizeTemplateText(item[1]))
        .filter(Boolean),
    ),
  ];
  const missingPlaceholders = usedPlaceholders.filter(
    (item) => !placeholders.includes(item),
  );

  return {
    content: fillOutreachTemplateContent(input.content, {
      companyName: '测试企业',
      intentArea: '3000m²',
      parkName: '测试园区',
      ...sampleData,
    }),
    missingPlaceholders,
    placeholders,
    usedPlaceholders,
  };
}

export function selectOutreachTemplatesForLead(
  templates: OutreachTemplateRow[],
  priorityLevel: string,
) {
  if (priorityLevel === 'A') {
    return templates.filter(
      (item) => item.priorityLevel === 'A' || item.priorityLevel === 'B',
    );
  }
  return templates.filter((item) => item.priorityLevel === priorityLevel);
}

export function pickOutreachTemplate(
  templates: OutreachTemplateRow[],
  priorityLevel: string,
  totalScore: number,
) {
  let preferredPriority = 'C';
  if (priorityLevel === 'A' || totalScore >= 80) {
    preferredPriority = 'A';
  } else if (priorityLevel === 'B' || totalScore >= 60) {
    preferredPriority = 'B';
  }

  return (
    templates.find((item) => item.priorityLevel === preferredPriority) ||
    templates[0] ||
    null
  );
}

export async function ensureOutreachTemplateTable() {
  await assertInvestmentRadarTablesReady([
    'investment_outreach_template',
    'investment_outreach_template_version',
  ]);

  await executeIgnoreDuplicate(`
    ALTER TABLE investment_outreach_template
    ADD COLUMN approval_status VARCHAR(30) NOT NULL DEFAULT 'APPROVED'
  `);
  await executeIgnoreDuplicate(`
    ALTER TABLE investment_outreach_template
    ADD COLUMN version_no INT NOT NULL DEFAULT 1
  `);
  for (const template of DEFAULT_OUTREACH_TEMPLATES) {
    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO investment_outreach_template
          (template_code, template_name, task_type, channel, priority_level, content, placeholder_json, enabled, approval_status, version_no, create_time, update_time)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, 1, 'APPROVED', 1, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          approval_status = COALESCE(NULLIF(approval_status, ''), 'APPROVED'),
          version_no = GREATEST(version_no, 1)
      `,
      template.templateCode,
      template.templateName,
      template.taskType,
      template.channel,
      template.priorityLevel,
      template.content,
      normalizePlaceholderJson(template.placeholderJson),
    );
  }
}

async function createOutreachTemplateVersion(
  templateId: number,
  changeType: string,
) {
  const template = await findOutreachTemplateById(templateId);
  if (!template) {
    return null;
  }

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_outreach_template_version
        (template_id, template_code, template_name, task_type, channel, priority_level, content, placeholder_json, approval_status, version_no, change_type, create_time)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
    `,
    template.templateId,
    template.templateCode,
    template.templateName,
    template.taskType,
    template.channel,
    template.priorityLevel,
    template.content,
    normalizePlaceholderJson(template.placeholderJson),
    template.approvalStatus,
    template.versionNo,
    changeType,
  );

  return template;
}

export async function listOutreachTemplates(
  params: OutreachTemplateListParams = {},
) {
  await ensureOutreachTemplateTable();

  const currentPage = Math.max(1, Number(params.currentPage || 1));
  const pageSize = Math.max(1, Math.min(100, Number(params.pageSize || 20)));
  const keyword = normalizeTemplateText(params.keyword);
  const channel = normalizeTemplateText(params.channel);
  const taskType = normalizeTemplateText(params.taskType);
  const enabled = normalizeTemplateText(params.enabled);
  const approvalStatus = normalizeTemplateText(params.approvalStatus);

  const whereClauses = ['1 = 1'];
  const whereParams: any[] = [];

  if (channel) {
    whereClauses.push('channel = ?');
    whereParams.push(channel);
  }
  if (taskType) {
    whereClauses.push('task_type = ?');
    whereParams.push(taskType);
  }
  if (enabled && enabled !== 'ALL') {
    whereClauses.push('enabled = ?');
    whereParams.push(['1', 'true', 'TRUE'].includes(enabled) ? 1 : 0);
  }
  if (approvalStatus && approvalStatus !== 'ALL') {
    whereClauses.push('approval_status = ?');
    whereParams.push(approvalStatus);
  }
  if (keyword) {
    whereClauses.push(
      '(template_code LIKE ? OR template_name LIKE ? OR content LIKE ?)',
    );
    const likeKeyword = `%${keyword}%`;
    whereParams.push(likeKeyword, likeKeyword, likeKeyword);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
  const offset = (currentPage - 1) * pageSize;
  const [countRows, rows] = await Promise.all([
    prismaClient.$queryRawUnsafe<Array<{ total: bigint | number }>>(
      `
        SELECT COUNT(*) AS total
        FROM investment_outreach_template
        ${whereSql}
      `,
      ...whereParams,
    ),
    prismaClient.$queryRawUnsafe<any[]>(
      `
        SELECT
          template_id AS templateId,
          template_code AS templateCode,
          template_name AS templateName,
          task_type AS taskType,
          channel,
          priority_level AS priorityLevel,
          content,
          placeholder_json AS placeholderJson,
          enabled,
          approval_status AS approvalStatus,
          version_no AS versionNo,
          create_time AS createTime,
          update_time AS updateTime
        FROM investment_outreach_template
        ${whereSql}
        ORDER BY enabled DESC, priority_level ASC, template_id ASC
        LIMIT ? OFFSET ?
      `,
      ...whereParams,
      pageSize,
      offset,
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map((row) => serializeTemplateRow(row)),
    page: {
      currentPage,
      pageSize,
      total,
    },
    total,
  };
}

export async function listEnabledOutreachTemplates() {
  const result = await listOutreachTemplates({
    approvalStatus: 'APPROVED',
    enabled: '1',
    pageSize: 100,
  });
  return result.items;
}

export async function createOutreachTemplate(input: OutreachTemplateInput) {
  await ensureOutreachTemplateTable();
  assertTemplateInput(input);

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_outreach_template
        (template_code, template_name, task_type, channel, priority_level, content, placeholder_json, enabled, approval_status, version_no, create_time, update_time)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, 0, 'PENDING_APPROVAL', 1, NOW(3), NOW(3))
    `,
    normalizeTemplateText(input.templateCode),
    normalizeTemplateText(input.templateName),
    normalizeTemplateText(input.taskType) || 'OUTREACH',
    normalizeTemplateText(input.channel) || 'SMS',
    normalizeTemplateText(input.priorityLevel) || 'C',
    normalizeTemplateText(input.content),
    normalizePlaceholderJson(input.placeholderJson),
  );

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        template_id AS templateId,
        template_code AS templateCode,
        template_name AS templateName,
        task_type AS taskType,
        channel,
        priority_level AS priorityLevel,
        content,
        placeholder_json AS placeholderJson,
        enabled,
        approval_status AS approvalStatus,
        version_no AS versionNo,
        create_time AS createTime,
        update_time AS updateTime
      FROM investment_outreach_template
      WHERE template_code = ?
      LIMIT 1
    `,
    normalizeTemplateText(input.templateCode),
  );

  const template = serializeTemplateRow(rows[0]);
  await createOutreachTemplateVersion(template.templateId, 'CREATE');
  return template;
}

export async function updateOutreachTemplate(
  templateId: number,
  input: OutreachTemplateInput,
) {
  await ensureOutreachTemplateTable();
  assertTemplateInput(input);

  const affected = await prismaClient.$executeRawUnsafe(
    `
      UPDATE investment_outreach_template
      SET
        template_code = ?,
        template_name = ?,
        task_type = ?,
        channel = ?,
        priority_level = ?,
        content = ?,
        placeholder_json = ?,
        enabled = 0,
        approval_status = 'PENDING_APPROVAL',
        version_no = version_no + 1,
        update_time = NOW(3)
      WHERE template_id = ?
    `,
    normalizeTemplateText(input.templateCode),
    normalizeTemplateText(input.templateName),
    normalizeTemplateText(input.taskType) || 'OUTREACH',
    normalizeTemplateText(input.channel) || 'SMS',
    normalizeTemplateText(input.priorityLevel) || 'C',
    normalizeTemplateText(input.content),
    normalizePlaceholderJson(input.placeholderJson),
    templateId,
  );

  if (Number(affected || 0) === 0) {
    return findOutreachTemplateById(templateId);
  }

  return createOutreachTemplateVersion(templateId, 'UPDATE');
}

export async function setOutreachTemplateEnabled(
  templateId: number,
  enabled: boolean,
) {
  await ensureOutreachTemplateTable();

  const existingTemplate = await findOutreachTemplateById(templateId);
  if (!existingTemplate) {
    return null;
  }
  if (enabled && existingTemplate.approvalStatus !== 'APPROVED') {
    throw new Error('模板未审批通过，不能启用');
  }

  const affected = await prismaClient.$executeRawUnsafe(
    `
      UPDATE investment_outreach_template
      SET enabled = ?, update_time = NOW(3)
      WHERE template_id = ?
    `,
    enabled ? 1 : 0,
    templateId,
  );

  if (Number(affected || 0) === 0) {
    const refreshedTemplate = await findOutreachTemplateById(templateId);

    return {
      enabled: Boolean(refreshedTemplate?.enabled),
      templateId,
    };
  }

  return {
    enabled,
    templateId,
  };
}

export async function setOutreachTemplateApproval(
  templateId: number,
  approvalStatus: 'APPROVED' | 'REJECTED',
) {
  await ensureOutreachTemplateTable();

  const enabled = approvalStatus === 'APPROVED' ? 1 : 0;
  const affected = await prismaClient.$executeRawUnsafe(
    `
      UPDATE investment_outreach_template
      SET approval_status = ?, enabled = ?, update_time = NOW(3)
      WHERE template_id = ?
    `,
    approvalStatus,
    enabled,
    templateId,
  );

  if (Number(affected || 0) === 0) {
    return findOutreachTemplateById(templateId);
  }

  return createOutreachTemplateVersion(templateId, approvalStatus);
}

export async function submitOutreachTemplateApproval(templateId: number) {
  await ensureOutreachTemplateTable();

  const affected = await prismaClient.$executeRawUnsafe(
    `
      UPDATE investment_outreach_template
      SET approval_status = 'PENDING_APPROVAL', enabled = 0, update_time = NOW(3)
      WHERE template_id = ?
    `,
    templateId,
  );

  if (Number(affected || 0) === 0) {
    return findOutreachTemplateById(templateId);
  }

  return createOutreachTemplateVersion(templateId, 'SUBMIT_APPROVAL');
}

export async function listOutreachTemplateVersions(templateId: number) {
  await ensureOutreachTemplateTable();

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        version_id AS versionId,
        template_id AS templateId,
        template_code AS templateCode,
        template_name AS templateName,
        task_type AS taskType,
        channel,
        priority_level AS priorityLevel,
        content,
        placeholder_json AS placeholderJson,
        approval_status AS approvalStatus,
        version_no AS versionNo,
        change_type AS changeType,
        create_time AS createTime,
        create_time AS updateTime,
        CASE WHEN approval_status = 'APPROVED' THEN 1 ELSE 0 END AS enabled
      FROM investment_outreach_template_version
      WHERE template_id = ?
      ORDER BY version_no DESC, version_id DESC
    `,
    templateId,
  );

  return rows.map((row) => ({
    ...serializeTemplateRow(row),
    changeType: row.changeType || '',
    versionId: Number(row.versionId || 0),
  })) as OutreachTemplateVersionRow[];
}

export async function getOutreachTemplateStats() {
  await ensureOutreachTemplateTable();

  const taskTableRows = await prismaClient.$queryRawUnsafe<any[]>(
    "SHOW TABLES LIKE 'investment_outreach_task'",
  );
  if (taskTableRows.length === 0) {
    const templateRows = await prismaClient.$queryRawUnsafe<any[]>(
      `
        SELECT
          template_id AS templateId,
          template_code AS templateCode,
          template_name AS templateName
        FROM investment_outreach_template
        ORDER BY template_id ASC
      `,
    );

    return templateRows.map((row) => ({
      failedTasks: 0,
      negativeReplies: 0,
      positiveReplies: 0,
      sentTasks: 0,
      templateCode: row.templateCode || '',
      templateId: Number(row.templateId || 0),
      templateName: row.templateName || '',
      totalTasks: 0,
    })) as OutreachTemplateStatsRow[];
  }

  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        t.template_id AS templateId,
        t.template_code AS templateCode,
        t.template_name AS templateName,
        COUNT(ot.task_id) AS totalTasks,
        SUM(CASE WHEN ot.status = 'SENT' THEN 1 ELSE 0 END) AS sentTasks,
        SUM(CASE WHEN ot.result_code IS NOT NULL AND ot.result_code <> 'SUCCESS' THEN 1 ELSE 0 END) AS failedTasks,
        SUM(CASE WHEN ot.reply_status IN ('POSITIVE', 'INTERESTED') THEN 1 ELSE 0 END) AS positiveReplies,
        SUM(CASE WHEN ot.reply_status IN ('NEGATIVE', 'REFUSED', 'UNSUBSCRIBED', 'BLACKLIST', 'BLACKLISTED') THEN 1 ELSE 0 END) AS negativeReplies
      FROM investment_outreach_template t
      LEFT JOIN investment_outreach_task ot
        ON ot.template_code COLLATE utf8mb4_unicode_ci =
          t.template_code COLLATE utf8mb4_unicode_ci
      GROUP BY t.template_id, t.template_code, t.template_name
      ORDER BY totalTasks DESC, t.template_id ASC
    `,
  );

  return rows.map((row) => ({
    failedTasks: Number(row.failedTasks || 0),
    negativeReplies: Number(row.negativeReplies || 0),
    positiveReplies: Number(row.positiveReplies || 0),
    sentTasks: Number(row.sentTasks || 0),
    templateCode: row.templateCode || '',
    templateId: Number(row.templateId || 0),
    templateName: row.templateName || '',
    totalTasks: Number(row.totalTasks || 0),
  })) as OutreachTemplateStatsRow[];
}

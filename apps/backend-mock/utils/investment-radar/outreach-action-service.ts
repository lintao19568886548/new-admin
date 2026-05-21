import { prismaClient } from '~/utils/db';

import { ensureContactRestrictionTable } from './contact-restriction-service';

interface OutreachCandidateLead {
  companyName: string;
  enterpriseId?: null | number;
  intentArea?: null | number;
  leadId: number;
  ownerUserId: number;
  parkName: string;
  phoneNumber: string;
  priorityLevel: string;
  totalScore: number;
}

interface OutreachTemplate {
  channel: string;
  content: string;
  priorityLevel: string;
  taskType: string;
  templateCode: string;
}

export interface RadarOutreachActionRebuildResult {
  createdOutreachTaskCount: number;
  outreachTargetLeadCount: number;
  pendingOutreachTaskCount: number;
}

const templates: OutreachTemplate[] = [
  {
    channel: 'SMS',
    content:
      '您好，{companyName}近期有{intentArea}厂房需求，我们在{parkName}有匹配房源，可安排专人对接。',
    priorityLevel: 'A',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_A_SMS',
  },
  {
    channel: 'SMS',
    content:
      '您好，关注到贵司可能有扩产或租赁需求，我们可提供{parkName}可租厂房清单供参考。',
    priorityLevel: 'B',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_B_SMS',
  },
  {
    channel: 'WECHAT',
    content:
      '补充核实{companyName}的具体需求和时间窗口，确认后进入正式招商跟进。',
    priorityLevel: 'C',
    taskType: 'FOLLOW_UP',
    templateCode: 'RADAR_C_WECHAT',
  },
];

function fillTemplate(content: string, data: Record<string, string>) {
  return content.replaceAll(/\{(\w+)\}/g, (_, key: string) => data[key] || '-');
}

function formatIntentArea(intentArea?: null | number) {
  return intentArea
    ? `${Number(intentArea).toLocaleString('zh-CN')}m²`
    : '待确认面积';
}

function pickTemplate(priorityLevel: string, totalScore: number) {
  if (priorityLevel === 'A' || totalScore >= 80) {
    return templates[0];
  }
  if (priorityLevel === 'B' || totalScore >= 60) {
    return templates[1];
  }
  return templates[2];
}

async function ensureOutreachTaskTable() {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS investment_outreach_task (
      task_id BIGINT NOT NULL AUTO_INCREMENT,
      lead_id BIGINT NOT NULL,
      task_type VARCHAR(50) NOT NULL,
      channel VARCHAR(50) NOT NULL,
      phone_number VARCHAR(50) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      template_code VARCHAR(100) NULL,
      scheduled_at DATETIME(3) NULL,
      sent_at DATETIME(3) NULL,
      result_code VARCHAR(50) NULL,
      result_message TEXT NULL,
      reply_status VARCHAR(30) NOT NULL DEFAULT 'NO_REPLY',
      reply_content TEXT NULL,
      reply_time DATETIME(3) NULL,
      sent_by BIGINT NULL,
      create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (task_id),
      INDEX idx_investment_outreach_task_lead_status (lead_id, status),
      INDEX idx_investment_outreach_task_status_time (status, scheduled_at),
      INDEX idx_investment_outreach_task_channel (channel),
      INDEX idx_investment_outreach_task_sent_by (sent_by)
    )
  `);
}

async function listOutreachCandidates(
  limit: number,
): Promise<OutreachCandidateLead[]> {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        l.lead_id AS leadId,
        l.enterprise_id AS enterpriseId,
        l.owner_user_id AS ownerUserId,
        l.priority_level AS priorityLevel,
        l.total_score AS totalScore,
        l.intent_area AS intentArea,
        COALESCE(e.enterprise_name, '该企业') AS companyName,
        COALESCE(e.phone_number, '') AS phoneNumber,
        COALESCE(p.park_name, '园区') AS parkName
      FROM investment_lead l
      LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
      LEFT JOIN park p ON p.park_id = l.park_id
      WHERE l.is_deleted = 0
        AND l.owner_user_id IS NOT NULL
        AND l.latest_contact_time IS NULL
        AND l.stage IN ('NEW', 'PENDING_CONTACT')
        AND l.stage NOT IN ('CLOSED', 'DEAL', 'INVALID')
        AND (l.invalid_reason IS NULL OR l.invalid_reason = '')
        AND COALESCE(e.phone_number, '') <> ''
        AND (
          l.priority_level IN ('A', 'B')
          OR l.total_score >= 60
        )
        AND NOT EXISTS (
          SELECT 1
          FROM investment_outreach_task t
          WHERE t.lead_id = l.lead_id
            AND t.status IN ('PENDING', 'RUNNING', 'SENT')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM contact_restriction cr
          WHERE cr.status = 'ACTIVE'
            AND (
              cr.lead_id = l.lead_id
              OR cr.enterprise_id = l.enterprise_id
              OR cr.phone_number = e.phone_number
            )
        )
      ORDER BY l.total_score DESC, l.update_time DESC
      LIMIT ?
    `,
    limit,
  );

  return rows.map((item) => ({
    companyName: item.companyName || '该企业',
    enterpriseId:
      item.enterpriseId === null || item.enterpriseId === undefined
        ? null
        : Number(item.enterpriseId),
    intentArea:
      item.intentArea === null || item.intentArea === undefined
        ? null
        : Number(item.intentArea),
    leadId: Number(item.leadId),
    ownerUserId: Number(item.ownerUserId),
    parkName: item.parkName || '园区',
    phoneNumber: String(item.phoneNumber || '').trim(),
    priorityLevel: item.priorityLevel || 'C',
    totalScore: Number(item.totalScore || 0),
  }));
}

async function createOutreachTask(lead: OutreachCandidateLead) {
  const template = pickTemplate(lead.priorityLevel, lead.totalScore);
  const content = fillTemplate(template.content, {
    companyName: lead.companyName || '该企业',
    intentArea: formatIntentArea(lead.intentArea),
    parkName: lead.parkName || '园区',
  });

  const affected = await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_outreach_task
        (lead_id, task_type, channel, phone_number, status, template_code, scheduled_at, result_code, result_message, reply_status, sent_by, create_time, update_time)
      SELECT ?, ?, ?, ?, 'PENDING', ?, NOW(3), NULL, ?, 'NO_REPLY', ?, NOW(3), NOW(3)
      WHERE NOT EXISTS (
        SELECT 1
        FROM investment_outreach_task
        WHERE lead_id = ?
          AND status IN ('PENDING', 'RUNNING', 'SENT')
      )
    `,
    lead.leadId,
    template.taskType,
    template.channel,
    lead.phoneNumber,
    template.templateCode,
    content,
    lead.ownerUserId,
    lead.leadId,
  );

  return Number(affected || 0) > 0;
}

async function countPendingOutreachTasks() {
  const rows = await prismaClient.$queryRawUnsafe<Array<{ total: unknown }>>(
    `
      SELECT COUNT(*) AS total
      FROM investment_outreach_task
      WHERE status IN ('PENDING', 'RUNNING', 'SENT')
    `,
  );

  return Number(rows[0]?.total || 0);
}

export async function rebuildRadarOutreachActions(
  limit = 50,
): Promise<RadarOutreachActionRebuildResult> {
  await ensureOutreachTaskTable();
  await ensureContactRestrictionTable();

  const leads = await listOutreachCandidates(limit);
  let createdOutreachTaskCount = 0;

  for (const lead of leads) {
    if (await createOutreachTask(lead)) {
      createdOutreachTaskCount += 1;
    }
  }

  const pendingOutreachTaskCount = await countPendingOutreachTasks();

  return {
    createdOutreachTaskCount,
    outreachTargetLeadCount: leads.length,
    pendingOutreachTaskCount,
  };
}

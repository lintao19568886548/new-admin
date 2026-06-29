import { prismaClient } from '~/utils/db';

import { normalizeContactPhone } from './contact-restriction-policy';
import { ensureContactRestrictionTable } from './contact-restriction-service';
import {
  fillOutreachTemplateContent,
  listEnabledOutreachTemplates,
  pickOutreachTemplate,
} from './outreach-template-service';
import { assertInvestmentRadarTableReady } from './schema-guard';

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

export interface RadarOutreachActionRebuildResult {
  createdOutreachTaskCount: number;
  outreachTargetLeadCount: number;
  pendingOutreachTaskCount: number;
}

function formatIntentArea(intentArea?: null | number) {
  return intentArea
    ? `${Number(intentArea).toLocaleString('zh-CN')}m²`
    : '待确认面积';
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

export async function ensureOutreachTaskTable() {
  await assertInvestmentRadarTableReady('investment_outreach_task');

  await executeIgnoreDuplicate(`
    ALTER TABLE investment_outreach_task
    ADD COLUMN content TEXT NULL
  `);
  await executeIgnoreDuplicate(`
    ALTER TABLE investment_outreach_task
    ADD COLUMN provider_task_id VARCHAR(100) NULL
  `);
  await executeIgnoreDuplicate(`
    ALTER TABLE investment_outreach_task
    ADD COLUMN provider_response_json MEDIUMTEXT NULL
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
    phoneNumber: normalizeContactPhone(item.phoneNumber),
    priorityLevel: item.priorityLevel || 'C',
    totalScore: Number(item.totalScore || 0),
  }));
}

async function createOutreachTask(lead: OutreachCandidateLead) {
  const enabledTemplates = await listEnabledOutreachTemplates();
  const template = pickOutreachTemplate(
    enabledTemplates,
    lead.priorityLevel,
    lead.totalScore,
  );
  if (!template) {
    return false;
  }

  const content = fillOutreachTemplateContent(template.content, {
    companyName: lead.companyName || '该企业',
    intentArea: formatIntentArea(lead.intentArea),
    parkName: lead.parkName || '园区',
  });

  const affected = await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_outreach_task
        (lead_id, task_type, channel, phone_number, status, template_code, content, scheduled_at, result_code, result_message, reply_status, sent_by, create_time, update_time)
      SELECT ?, ?, ?, ?, 'PENDING', ?, ?, NOW(3), NULL, ?, 'NO_REPLY', ?, NOW(3), NOW(3)
      WHERE NOT EXISTS (
        SELECT 1
        FROM investment_outreach_task
        WHERE lead_id = ?
          AND status IN ('PENDING', 'RUNNING', 'SENT')
      )
        AND NOT EXISTS (
          SELECT 1
          FROM contact_restriction cr
          WHERE cr.status = 'ACTIVE'
            AND (
              cr.lead_id = ?
              OR cr.enterprise_id = ?
              OR cr.phone_number = ?
            )
        )
    `,
    lead.leadId,
    template.taskType,
    template.channel,
    lead.phoneNumber,
    template.templateCode,
    content,
    content,
    lead.ownerUserId,
    lead.leadId,
    lead.leadId,
    lead.enterpriseId || null,
    lead.phoneNumber,
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

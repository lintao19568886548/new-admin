import { prismaClient } from '~/utils/db';

import { tableExists } from './analytics-service';

export interface RadarSalesActionRebuildResult {
  assignedLeadCount: number;
  createdSopReminderCount: number;
  pendingSopReminderCount: number;
  targetLeadCount: number;
}

interface AssignableLead {
  createTime?: Date | null | string;
  enterpriseName: string;
  latestContactTime?: Date | null | string;
  leadId: number;
  ownerUserId?: null | number;
  parkId?: null | number;
  priorityLevel: string;
  stage: string;
  totalScore: number;
}

interface AssignableUser {
  activeLeadCount: number;
  parkId?: null | number;
  userId: number;
  userName: string;
}

const inactiveStages = new Set(['CLOSED', 'DEAL', 'INVALID']);

async function ensureSopReminderTable() {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS investment_sop_reminder (
      reminder_id BIGINT NOT NULL AUTO_INCREMENT,
      lead_id BIGINT NOT NULL,
      reminder_type VARCHAR(50) NOT NULL,
      title VARCHAR(100) NOT NULL,
      description TEXT NULL,
      due_time DATETIME(3) NOT NULL,
      reminder_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      handled_time DATETIME(3) NULL,
      create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (reminder_id),
      UNIQUE KEY uk_investment_sop_reminder_lead_type (lead_id, reminder_type),
      INDEX idx_investment_sop_reminder_lead_status (lead_id, reminder_status),
      INDEX idx_investment_sop_reminder_due_time (due_time)
    )
  `);
}

async function ensureAssignmentLogTable() {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS investment_lead_assignment_log (
      assignment_id BIGINT NOT NULL AUTO_INCREMENT,
      lead_id BIGINT NOT NULL,
      previous_owner_user_id BIGINT NULL,
      owner_user_id BIGINT NOT NULL,
      owner_name VARCHAR(100) NULL,
      assignment_source VARCHAR(50) NOT NULL,
      assign_reason VARCHAR(255) NULL,
      create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (assignment_id),
      INDEX idx_investment_lead_assignment_log_lead (lead_id),
      INDEX idx_investment_lead_assignment_log_owner (owner_user_id),
      INDEX idx_investment_lead_assignment_log_time (create_time)
    )
  `);
}

function toDate(value: unknown, fallback = new Date()) {
  if (!value) {
    return fallback;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

function isHighValueLead(lead: AssignableLead) {
  return (
    ['A', 'B'].includes(lead.priorityLevel) ||
    Number(lead.totalScore || 0) >= 60
  );
}

function isActiveLead(lead: AssignableLead) {
  return !inactiveStages.has(String(lead.stage || ''));
}

async function listAssignableUsers(): Promise<AssignableUser[]> {
  const users = await prismaClient.$queryRawUnsafe<any[]>(`
    SELECT
      u.id AS userId,
      COALESCE(NULLIF(u.real_name, ''), u.username) AS userName,
      u.park_id AS parkId,
      COUNT(l.lead_id) AS activeLeadCount
    FROM user u
    LEFT JOIN investment_lead l
      ON l.owner_user_id = u.id
      AND l.is_deleted = 0
      AND l.stage NOT IN ('CLOSED', 'DEAL', 'INVALID')
    WHERE COALESCE(u.status, 1) = 1
    GROUP BY u.id, userName, u.park_id
    ORDER BY activeLeadCount ASC, u.id ASC
    LIMIT 50
  `);

  return users.map((item) => ({
    activeLeadCount: Number(item.activeLeadCount || 0),
    parkId:
      item.parkId === null || item.parkId === undefined
        ? null
        : Number(item.parkId),
    userId: Number(item.userId),
    userName: item.userName || '',
  }));
}

async function listTargetLeads(limit: number): Promise<AssignableLead[]> {
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT
        l.lead_id AS leadId,
        l.park_id AS parkId,
        l.owner_user_id AS ownerUserId,
        l.priority_level AS priorityLevel,
        l.total_score AS totalScore,
        l.stage,
        l.latest_contact_time AS latestContactTime,
        l.create_time AS createTime,
        COALESCE(e.enterprise_name, '') AS enterpriseName
      FROM investment_lead l
      LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
      WHERE l.is_deleted = 0
        AND l.stage NOT IN ('CLOSED', 'DEAL', 'INVALID')
        AND (
          l.priority_level IN ('A', 'B')
          OR l.total_score >= 60
        )
      ORDER BY l.owner_user_id IS NULL DESC, l.total_score DESC, l.update_time DESC
      LIMIT ?
    `,
    limit,
  );

  return rows.map((item) => ({
    createTime: item.createTime || null,
    enterpriseName: item.enterpriseName || '',
    latestContactTime: item.latestContactTime || null,
    leadId: Number(item.leadId),
    ownerUserId:
      item.ownerUserId === null || item.ownerUserId === undefined
        ? null
        : Number(item.ownerUserId),
    parkId:
      item.parkId === null || item.parkId === undefined
        ? null
        : Number(item.parkId),
    priorityLevel: item.priorityLevel || 'C',
    stage: item.stage || 'NEW',
    totalScore: Number(item.totalScore || 0),
  }));
}

function pickOwner(lead: AssignableLead, users: AssignableUser[]) {
  const sameParkUsers =
    lead.parkId === null || lead.parkId === undefined
      ? []
      : users.filter((user) => user.parkId === lead.parkId);
  const candidates = sameParkUsers.length > 0 ? sameParkUsers : users;
  return [...candidates].sort(
    (a, b) => a.activeLeadCount - b.activeLeadCount || a.userId - b.userId,
  )[0];
}

async function assignLeads(leads: AssignableLead[], users: AssignableUser[]) {
  if (users.length === 0) {
    return 0;
  }

  let assignedLeadCount = 0;
  for (const lead of leads) {
    if (lead.ownerUserId || !isActiveLead(lead) || !isHighValueLead(lead)) {
      continue;
    }

    const owner = pickOwner(lead, users);
    if (!owner) {
      continue;
    }

    const affected = await prismaClient.$executeRawUnsafe(
      `
        UPDATE investment_lead
        SET
          owner_user_id = ?,
          stage = CASE WHEN stage = 'NEW' THEN 'PENDING_CONTACT' ELSE stage END,
          update_time = NOW(3)
        WHERE lead_id = ?
          AND is_deleted = 0
          AND owner_user_id IS NULL
      `,
      owner.userId,
      lead.leadId,
    );

    if (Number(affected || 0) === 0) {
      continue;
    }

    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO investment_lead_assignment_log (
          lead_id, previous_owner_user_id, owner_user_id, owner_name,
          assignment_source, assign_reason, create_time
        )
        VALUES (?, NULL, ?, ?, 'PIPELINE_AUTO', ?, NOW(3))
      `,
      lead.leadId,
      owner.userId,
      owner.userName || null,
      `${lead.priorityLevel}级潜客，总分${lead.totalScore}`,
    );

    lead.ownerUserId = owner.userId;
    lead.stage = lead.stage === 'NEW' ? 'PENDING_CONTACT' : lead.stage;
    owner.activeLeadCount += 1;
    assignedLeadCount += 1;
  }

  return assignedLeadCount;
}

async function hasVisitRecord(leadId: number) {
  if (!(await tableExists('investment_visit_record'))) {
    return false;
  }

  const rows = await prismaClient.$queryRawUnsafe<Array<{ total: unknown }>>(
    `
      SELECT COUNT(*) AS total
      FROM investment_visit_record
      WHERE lead_id = ?
    `,
    leadId,
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function getLatestFollowTime(leadId: number) {
  if (!(await tableExists('investment_follow_record'))) {
    return null;
  }

  const rows = await prismaClient.$queryRawUnsafe<Array<{ latestTime: Date }>>(
    `
      SELECT MAX(create_time) AS latestTime
      FROM investment_follow_record
      WHERE lead_id = ?
    `,
    leadId,
  );
  return rows[0]?.latestTime || null;
}

async function getLatestVisitFeedbackTime(leadId: number) {
  if (!(await tableExists('investment_visit_record'))) {
    return null;
  }

  const rows = await prismaClient.$queryRawUnsafe<Array<{ latestTime: Date }>>(
    `
      SELECT MAX(COALESCE(actual_time, scheduled_time, update_time)) AS latestTime
      FROM investment_visit_record
      WHERE lead_id = ?
        AND feedback IS NOT NULL
        AND feedback <> ''
    `,
    leadId,
  );
  return rows[0]?.latestTime || null;
}

async function upsertReminder(params: {
  description: string;
  dueTime: Date;
  leadId: number;
  reminderType: string;
  title: string;
}) {
  const existingRows = await prismaClient.$queryRawUnsafe<
    Array<{ reminderStatus?: string }>
  >(
    `
      SELECT reminder_status AS reminderStatus
      FROM investment_sop_reminder
      WHERE lead_id = ? AND reminder_type = ?
      LIMIT 1
    `,
    params.leadId,
    params.reminderType,
  );

  const existing = existingRows[0] || null;
  if (existing?.reminderStatus === 'DONE') {
    return false;
  }

  const status = Date.now() > params.dueTime.getTime() ? 'OVERDUE' : 'PENDING';
  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_sop_reminder
        (lead_id, reminder_type, title, description, due_time, reminder_status, create_time, update_time)
      VALUES
        (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        description = VALUES(description),
        due_time = VALUES(due_time),
        reminder_status = CASE
          WHEN reminder_status = 'DONE' THEN reminder_status
          ELSE VALUES(reminder_status)
        END,
        update_time = NOW(3)
    `,
    params.leadId,
    params.reminderType,
    params.title,
    params.description,
    params.dueTime,
    status,
  );

  return !existing;
}

async function rebuildSopReminders(leads: AssignableLead[]) {
  let createdSopReminderCount = 0;

  for (const lead of leads) {
    if (!isActiveLead(lead) || !isHighValueLead(lead)) {
      continue;
    }

    if (lead.ownerUserId && !lead.latestContactTime) {
      const created = await upsertReminder({
        description: `${lead.enterpriseName || '该潜客'}已分配负责人，请在24小时内完成首次联系。`,
        dueTime: addHours(toDate(lead.createTime), 24),
        leadId: lead.leadId,
        reminderType: 'NEW_LEAD',
        title: '新线索待联系',
      });
      if (created) {
        createdSopReminderCount += 1;
      }
    }

    if (lead.stage === 'REPLIED' && !(await hasVisitRecord(lead.leadId))) {
      const created = await upsertReminder({
        description: `${lead.enterpriseName || '该潜客'}已有正向回复，请在48小时内安排带看。`,
        dueTime: addHours(toDate(lead.latestContactTime), 48),
        leadId: lead.leadId,
        reminderType: 'NEED_VISIT',
        title: '待安排带看',
      });
      if (created) {
        createdSopReminderCount += 1;
      }
    }

    if (lead.stage === 'VISIT') {
      const [latestFollowTime, latestVisitFeedbackTime] = await Promise.all([
        getLatestFollowTime(lead.leadId),
        getLatestVisitFeedbackTime(lead.leadId),
      ]);
      const latestActivityTime = [
        latestFollowTime,
        latestVisitFeedbackTime,
        lead.latestContactTime,
      ]
        .filter(Boolean)
        .map((item) => toDate(item))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      if (latestActivityTime) {
        const created = await upsertReminder({
          description: `${lead.enterpriseName || '该潜客'}已进入带看后推进阶段，请每周至少跟进一次并记录结果。`,
          dueTime: addHours(latestActivityTime, 24 * 7),
          leadId: lead.leadId,
          reminderType: 'WEEKLY_FOLLOW_UP',
          title: '持续跟进提醒',
        });
        if (created) {
          createdSopReminderCount += 1;
        }
      }
    }
  }

  return createdSopReminderCount;
}

async function countPendingSopReminders() {
  const rows = await prismaClient.$queryRawUnsafe<Array<{ total: unknown }>>(
    `
      SELECT COUNT(*) AS total
      FROM investment_sop_reminder
      WHERE reminder_status IN ('PENDING', 'OVERDUE')
    `,
  );
  return Number(rows[0]?.total || 0);
}

export async function rebuildRadarSalesActions(
  limit = 50,
): Promise<RadarSalesActionRebuildResult> {
  await ensureSopReminderTable();
  await ensureAssignmentLogTable();

  const [users, leads] = await Promise.all([
    listAssignableUsers(),
    listTargetLeads(limit),
  ]);

  const assignedLeadCount = await assignLeads(leads, users);
  const createdSopReminderCount = await rebuildSopReminders(leads);
  const pendingSopReminderCount = await countPendingSopReminders();

  return {
    assignedLeadCount,
    createdSopReminderCount,
    pendingSopReminderCount,
    targetLeadCount: leads.length,
  };
}

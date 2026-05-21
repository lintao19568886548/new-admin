import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

async function optionalQuery<T>(sql: string, ...params: any[]): Promise<T[]> {
  try {
    return await prismaClient.$queryRawUnsafe<T[]>(sql, ...params);
  } catch (error) {
    console.warn('radar optional SOP query skipped:', error);
    return [];
  }
}

interface Reminder {
  createTime: string;
  description: string;
  dueTime: string;
  handledTime: null | string;
  reminderId: number;
  reminderStatus: string;
  reminderType: string;
  title: string;
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

function generateReminders(
  lead: any,
  followRecords: any[],
  visitRecords: any[],
): Reminder[] {
  const reminders: Reminder[] = [];
  const now = Date.now();
  const stage = String(lead.stage || '');

  if (['CLOSED', 'DEAL', 'INVALID'].includes(stage)) {
    return reminders;
  }

  const createTime = lead.createTime
    ? new Date(lead.createTime).getTime()
    : now;
  const latestContactTime = lead.latestContactTime
    ? new Date(lead.latestContactTime).getTime()
    : null;

  const hasFollowRecord = followRecords.length > 0;
  const hasVisitRecord = visitRecords.length > 0;
  const lastVisitRecord = visitRecords[0];
  const hasVisitFeedback = lastVisitRecord && lastVisitRecord.feedback;

  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * TWENTY_FOUR_HOURS;

  if (!latestContactTime && !hasFollowRecord) {
    const dueTime = new Date(createTime + TWENTY_FOUR_HOURS);
    reminders.push({
      createTime: new Date(createTime).toISOString(),
      description: '新线索创建后24小时内未进行任何联系，请及时跟进',
      dueTime: dueTime.toISOString(),
      handledTime: null,
      reminderId: 0,
      reminderStatus: now > dueTime.getTime() ? 'OVERDUE' : 'PENDING',
      reminderType: 'NEW_LEAD',
      title: '新线索待联系',
    });
  }

  if (
    stage === 'REPLIED' ||
    followRecords.some(
      (f) => f.followResult === 'POSITIVE' || f.followResult === 'INTENTED',
    )
  ) {
    const positiveReplyTime = followRecords.find(
      (f) => f.followResult === 'POSITIVE' || f.followResult === 'INTENTED',
    )?.createTime;
    const timeForReminder = positiveReplyTime
      ? new Date(positiveReplyTime).getTime() + FORTY_EIGHT_HOURS
      : now;

    if (!hasVisitRecord) {
      const dueTime = new Date(timeForReminder);
      reminders.push({
        createTime: new Date(timeForReminder - FORTY_EIGHT_HOURS).toISOString(),
        description: '客户已正向回复，请在48小时内安排带看',
        dueTime: dueTime.toISOString(),
        handledTime: null,
        reminderId: 0,
        reminderStatus: now > dueTime.getTime() ? 'OVERDUE' : 'PENDING',
        reminderType: 'NEED_VISIT',
        title: '待安排带看',
      });
    }
  }

  if (hasVisitRecord && !hasVisitFeedback) {
    const visitTime =
      lastVisitRecord.actualTime || lastVisitRecord.scheduledTime;
    if (visitTime) {
      const visitTimestamp = new Date(visitTime).getTime();
      const dueTime = new Date(visitTimestamp + TWENTY_FOUR_HOURS);
      reminders.push({
        createTime: new Date(visitTimestamp).toISOString(),
        description: '带看已完成，请及时记录客户反馈',
        dueTime: dueTime.toISOString(),
        handledTime: null,
        reminderId: 0,
        reminderStatus: now > dueTime.getTime() ? 'OVERDUE' : 'PENDING',
        reminderType: 'VISIT_FEEDBACK',
        title: '待记录带看反馈',
      });
    }
  }

  if (stage === 'VISIT' && hasVisitRecord && hasVisitFeedback) {
    const latestFollowTime = followRecords[0]?.createTime
      ? new Date(followRecords[0].createTime).getTime()
      : null;
    const latestVisitTime =
      lastVisitRecord.actualTime ||
      lastVisitRecord.scheduledTime ||
      lastVisitRecord.createTime;
    const latestVisitTimestamp = latestVisitTime
      ? new Date(latestVisitTime).getTime()
      : null;
    const latestActivityTime = [
      latestFollowTime,
      latestVisitTimestamp,
      latestContactTime,
    ]
      .filter((item): item is number => Number.isFinite(item))
      .sort((a, b) => b - a)[0];

    if (latestActivityTime) {
      const dueTime = new Date(latestActivityTime + SEVEN_DAYS);
      reminders.push({
        createTime: new Date(latestActivityTime).toISOString(),
        description: '客户已进入带看后推进阶段，请每周至少跟进一次并记录结果',
        dueTime: dueTime.toISOString(),
        handledTime: null,
        reminderId: 0,
        reminderStatus: now > dueTime.getTime() ? 'OVERDUE' : 'PENDING',
        reminderType: 'WEEKLY_FOLLOW_UP',
        title: '持续跟进提醒',
      });
    }
  }

  return reminders.sort(
    (a, b) => new Date(a.dueTime).getTime() - new Date(b.dueTime).getTime(),
  );
}

async function syncGeneratedReminders(leadId: number, reminders: Reminder[]) {
  const generatedTypes = [
    'NEED_VISIT',
    'NEW_LEAD',
    'VISIT_FEEDBACK',
    'WEEKLY_FOLLOW_UP',
  ];
  const activeTypes = new Set(reminders.map((item) => item.reminderType));
  const staleTypes = generatedTypes.filter((type) => !activeTypes.has(type));

  if (staleTypes.length > 0) {
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE investment_sop_reminder
        SET
          reminder_status = 'DONE',
          handled_time = COALESCE(handled_time, NOW(3)),
          update_time = NOW(3)
        WHERE lead_id = ?
        AND reminder_status IN ('PENDING', 'OVERDUE')
        AND reminder_type IN (${staleTypes.map(() => '?').join(', ')})
      `,
      leadId,
      ...staleTypes,
    );
  }

  if (reminders.length === 0) {
    return;
  }

  for (const reminder of reminders) {
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
      leadId,
      reminder.reminderType,
      reminder.title,
      reminder.description,
      new Date(reminder.dueTime),
      reminder.reminderStatus,
    );
  }
}

async function completeOpenRemindersForInactiveLead(leadId: number) {
  await prismaClient.$executeRawUnsafe(
    `
      UPDATE investment_sop_reminder
      SET
        reminder_status = 'DONE',
        handled_time = COALESCE(handled_time, NOW(3)),
        update_time = NOW(3)
      WHERE lead_id = ?
      AND reminder_status IN ('PENDING', 'OVERDUE')
    `,
    leadId,
  );
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const leadId = Number(event.context.params?.id);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return badRequestResponse('leadId 无效', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      await ensureAssignmentLogTable();
      await ensureSopReminderTable();

      const leadRows = await prismaClient.$queryRawUnsafe<any[]>(
        `
          SELECT lead_id AS leadId, stage, create_time AS createTime, latest_contact_time AS latestContactTime
          FROM investment_lead
          WHERE lead_id = ? AND is_deleted = 0
          LIMIT 1
        `,
        leadId,
      );
      const lead = leadRows[0] || null;
      if (!lead) {
        return null;
      }

      const [assignmentRecords, followRecords, visitRecords] =
        await Promise.all([
          optionalQuery<any>(
            `
            SELECT
              owner_name AS ownerName,
              assignment_source AS assignmentSource,
              assign_reason AS assignReason,
              create_time AS createTime
            FROM investment_lead_assignment_log
            WHERE lead_id = ?
            ORDER BY create_time DESC, assignment_id DESC
            LIMIT 20
          `,
            leadId,
          ),
          optionalQuery<any>(
            `
            SELECT
              r.record_id AS recordId,
              r.follow_type AS followType,
              r.follow_result AS followResult,
              r.content,
              r.next_action AS nextAction,
              r.next_follow_time AS nextFollowTime,
              COALESCE(u.real_name, u.username) AS operatorName,
              r.create_time AS createTime
            FROM investment_follow_record r
            LEFT JOIN user u ON u.id = r.operator_user_id
            WHERE r.lead_id = ?
            ORDER BY r.create_time DESC, r.record_id DESC
            LIMIT 20
          `,
            leadId,
          ),
          optionalQuery<any>(
            `
            SELECT
              v.visit_id AS visitId,
              v.factory_floor_id AS factoryFloorId,
              v.scheduled_time AS scheduledTime,
              v.actual_time AS actualTime,
              v.visitor_name AS visitorName,
              v.visitor_phone AS visitorPhone,
              v.visit_status AS visitStatus,
              v.feedback,
              COALESCE(u.real_name, u.username) AS operatorName,
              v.create_time AS createTime
            FROM investment_visit_record v
            LEFT JOIN user u ON u.id = v.operator_user_id
            WHERE v.lead_id = ?
            ORDER BY v.scheduled_time DESC, v.visit_id DESC
            LIMIT 20
          `,
            leadId,
          ),
        ]);

      const generatedReminders = generateReminders(
        lead,
        followRecords,
        visitRecords,
      );

      await (['CLOSED', 'DEAL', 'INVALID'].includes(String(lead.stage || ''))
        ? completeOpenRemindersForInactiveLead(leadId)
        : syncGeneratedReminders(leadId, generatedReminders));

      const refreshedReminders = await optionalQuery<any>(
        `
          SELECT
            reminder_id AS reminderId,
            reminder_type AS reminderType,
            title,
            description,
            due_time AS dueTime,
            reminder_status AS reminderStatus,
            handled_time AS handledTime,
            create_time AS createTime
          FROM investment_sop_reminder
          WHERE lead_id = ? AND reminder_status IN ('PENDING', 'OVERDUE')
          ORDER BY
            CASE WHEN reminder_status = 'PENDING' THEN 0 ELSE 1 END,
            due_time ASC,
            reminder_id DESC
          LIMIT 20
        `,
        leadId,
      );

      const reminders = refreshedReminders.sort((a, b) => {
        const statusOrder = { PENDING: 0, OVERDUE: 1, DONE: 2 };
        const statusCompare =
          (statusOrder[a.reminderStatus] || 2) -
          (statusOrder[b.reminderStatus] || 2);
        if (statusCompare !== 0) return statusCompare;
        return new Date(a.dueTime).getTime() - new Date(b.dueTime).getTime();
      });

      return {
        assignmentRecords,
        followRecords,
        reminders,
        visitRecords,
      };
    });

    if (!result) {
      return badRequestResponse('线索不存在', event, 404);
    }

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get radar SOP failed:', error);
    return serverErrorResponse('获取SOP跟进失败', event);
  }
});

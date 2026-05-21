import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

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

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const currentPage = Math.max(1, Number(query.currentPage || 1));
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));
    const keyword = String(query.keyword || '').trim();
    const priorityLevel = String(query.priorityLevel || '').trim();
    const reminderStatus = String(query.reminderStatus || '').trim();
    const reminderType = String(query.reminderType || '').trim();
    const stage = String(query.stage || '').trim();

    const result = await runWithRadarSharedScope(async () => {
      await ensureSopReminderTable();
      await prismaClient.$executeRawUnsafe(`
        UPDATE investment_sop_reminder
        SET reminder_status = 'OVERDUE', update_time = NOW(3)
        WHERE reminder_status = 'PENDING' AND due_time < NOW(3)
      `);

      const whereClauses = ['l.is_deleted = 0'];
      const whereParams: any[] = [];

      if (reminderStatus) {
        whereClauses.push('r.reminder_status = ?');
        whereParams.push(reminderStatus);
      } else {
        whereClauses.push("r.reminder_status IN ('PENDING', 'OVERDUE')");
      }
      if (reminderType) {
        whereClauses.push('r.reminder_type = ?');
        whereParams.push(reminderType);
      }
      if (stage) {
        whereClauses.push('l.stage = ?');
        whereParams.push(stage);
      }
      if (priorityLevel) {
        whereClauses.push('l.priority_level = ?');
        whereParams.push(priorityLevel);
      }
      if (keyword) {
        whereClauses.push(
          '(e.enterprise_name LIKE ? OR e.contact_name LIKE ? OR e.phone_number LIKE ? OR p.park_name LIKE ? OR r.title LIKE ?)',
        );
        const likeKeyword = `%${keyword}%`;
        whereParams.push(
          likeKeyword,
          likeKeyword,
          likeKeyword,
          likeKeyword,
          likeKeyword,
        );
      }

      const fromSql = `
        FROM investment_sop_reminder r
        INNER JOIN investment_lead l ON l.lead_id = r.lead_id
        LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
        LEFT JOIN park p ON p.park_id = l.park_id
        LEFT JOIN user owner ON owner.id = l.owner_user_id
      `;
      const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
      const offset = (currentPage - 1) * pageSize;

      const [countRows, summaryRows, rows] = await Promise.all([
        prismaClient.$queryRawUnsafe<Array<{ total: bigint | number }>>(
          `
            SELECT COUNT(*) AS total
            ${fromSql}
            ${whereSql}
          `,
          ...whereParams,
        ),
        prismaClient.$queryRawUnsafe<
          Array<{
            needVisitReminders: bigint | number;
            newLeadReminders: bigint | number;
            overdueReminders: bigint | number;
            pendingReminders: bigint | number;
            totalReminders: bigint | number;
            visitFeedbackReminders: bigint | number;
            weeklyFollowUpReminders: bigint | number;
          }>
        >(
          `
            SELECT
              COUNT(*) AS totalReminders,
              SUM(CASE WHEN r.reminder_status = 'PENDING' THEN 1 ELSE 0 END) AS pendingReminders,
              SUM(CASE WHEN r.reminder_status = 'OVERDUE' THEN 1 ELSE 0 END) AS overdueReminders,
              SUM(CASE WHEN r.reminder_type = 'NEW_LEAD' THEN 1 ELSE 0 END) AS newLeadReminders,
              SUM(CASE WHEN r.reminder_type = 'NEED_VISIT' THEN 1 ELSE 0 END) AS needVisitReminders,
              SUM(CASE WHEN r.reminder_type = 'VISIT_FEEDBACK' THEN 1 ELSE 0 END) AS visitFeedbackReminders,
              SUM(CASE WHEN r.reminder_type = 'WEEKLY_FOLLOW_UP' THEN 1 ELSE 0 END) AS weeklyFollowUpReminders
            ${fromSql}
            ${whereSql}
          `,
          ...whereParams,
        ),
        prismaClient.$queryRawUnsafe<any[]>(
          `
            SELECT
              r.reminder_id AS reminderId,
              r.lead_id AS leadId,
              r.reminder_type AS reminderType,
              r.title,
              r.description,
              r.due_time AS dueTime,
              r.reminder_status AS reminderStatus,
              r.handled_time AS handledTime,
              r.create_time AS createTime,
              r.update_time AS updateTime,
              e.enterprise_name AS enterpriseName,
              e.contact_name AS contactName,
              e.phone_number AS phoneNumber,
              p.park_name AS parkName,
              l.stage,
              l.priority_level AS priorityLevel,
              l.total_score AS totalScore,
              l.latest_contact_time AS latestContactTime,
              COALESCE(owner.real_name, owner.username) AS ownerName
            ${fromSql}
            ${whereSql}
            ORDER BY
              CASE WHEN r.reminder_status = 'OVERDUE' THEN 0 ELSE 1 END,
              r.due_time ASC,
              r.reminder_id DESC
            LIMIT ? OFFSET ?
          `,
          ...whereParams,
          pageSize,
          offset,
        ),
      ]);

      const total = Number(countRows[0]?.total || 0);
      const summary = summaryRows[0] || {
        needVisitReminders: 0,
        newLeadReminders: 0,
        overdueReminders: 0,
        pendingReminders: 0,
        totalReminders: 0,
        visitFeedbackReminders: 0,
        weeklyFollowUpReminders: 0,
      };

      return {
        items: rows.map((item) => ({
          ...item,
          enterpriseName: item.enterpriseName || '-',
          leadId: Number(item.leadId || 0),
          reminderId: Number(item.reminderId || 0),
          totalScore: Number(item.totalScore || 0),
        })),
        page: {
          currentPage,
          pageSize,
          total,
        },
        summary: {
          needVisitReminders: Number(summary.needVisitReminders || 0),
          newLeadReminders: Number(summary.newLeadReminders || 0),
          overdueReminders: Number(summary.overdueReminders || 0),
          pendingReminders: Number(summary.pendingReminders || 0),
          totalReminders: Number(summary.totalReminders || 0),
          visitFeedbackReminders: Number(summary.visitFeedbackReminders || 0),
          weeklyFollowUpReminders: Number(summary.weeklyFollowUpReminders || 0),
        },
        total,
      };
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get radar sop reminder list failed:', error);
    return serverErrorResponse('获取SOP待办列表失败', event);
  }
});

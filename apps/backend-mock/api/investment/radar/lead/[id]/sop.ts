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

function buildDefaultReminder(lead: any) {
  if (
    !lead ||
    ['CLOSED', 'DEAL', 'INVALID'].includes(String(lead.stage || ''))
  ) {
    return null;
  }

  const dueTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return {
    createTime: new Date().toISOString(),
    description: '建议完成首轮触达并记录客户需求',
    dueTime: dueTime.toISOString(),
    handledTime: null,
    reminderId: 0,
    reminderStatus: 'PENDING',
    reminderType: 'FOLLOW_UP',
    title: '待跟进线索',
  };
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
      const leadRows = await prismaClient.$queryRawUnsafe<any[]>(
        `
          SELECT lead_id AS leadId, stage
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

      const [followRecords, reminders, visitRecords] = await Promise.all([
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
              reminder_id AS reminderId,
              reminder_type AS reminderType,
              title,
              description,
              due_time AS dueTime,
              reminder_status AS reminderStatus,
              handled_time AS handledTime,
              create_time AS createTime
            FROM investment_sop_reminder
            WHERE lead_id = ?
            ORDER BY
              CASE WHEN reminder_status = 'PENDING' THEN 0 ELSE 1 END,
              due_time ASC,
              reminder_id DESC
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

      const defaultReminder =
        reminders.length === 0 ? buildDefaultReminder(lead) : null;

      return {
        followRecords,
        reminders: defaultReminder ? [defaultReminder] : reminders,
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

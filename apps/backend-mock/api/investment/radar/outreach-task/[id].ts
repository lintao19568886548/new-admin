import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const taskId = String(event.context.params?.id || '').trim();
  if (!taskId) {
    return badRequestResponse('taskId 无效', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      const rows = await prismaClient.$queryRawUnsafe<any[]>(
        `
          SELECT
            t.task_id AS taskId,
            t.lead_id AS leadId,
            t.task_type AS taskType,
            t.channel,
            t.phone_number AS phoneNumber,
            t.status,
            t.template_code AS templateCode,
            t.scheduled_at AS scheduledAt,
            t.sent_at AS sentAt,
            COALESCE(sender.real_name, sender.username) AS sentByName,
            t.result_code AS resultCode,
            t.result_message AS resultMessage,
            t.reply_status AS replyStatus,
            t.reply_content AS replyContent,
            t.reply_time AS replyTime,
            t.create_time AS createTime,
            t.update_time AS updateTime,
            l.enterprise_id AS enterpriseId,
            l.park_id AS parkId,
            l.lead_source AS leadSource,
            l.intent_area AS intentArea,
            l.intent_score AS intentScore,
            l.match_score AS matchScore,
            l.reachable_score AS reachableScore,
            l.total_score AS totalScore,
            l.priority_level AS priorityLevel,
            l.stage,
            l.owner_user_id AS ownerUserId,
            l.latest_contact_time AS latestContactTime,
            l.invalid_reason AS invalidReason,
            e.enterprise_name AS enterpriseName,
            e.unified_social_credit_code AS unifiedSocialCreditCode,
            e.contact_name AS contactName,
            e.industry_name AS industryName,
            e.address,
            e.city,
            e.register_capital AS registerCapital,
            e.source_first AS sourceFirst,
            e.source_latest AS sourceLatest,
            e.last_signal_time AS latestSignalTime,
            p.park_name AS parkName,
            COALESCE(owner.real_name, owner.username) AS ownerName
          FROM investment_outreach_task t
          INNER JOIN investment_lead l ON l.lead_id = t.lead_id
          LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
          LEFT JOIN park p ON p.park_id = l.park_id
          LEFT JOIN user sender ON sender.id = t.sent_by
          LEFT JOIN user owner ON owner.id = l.owner_user_id
          WHERE t.task_id = ? AND l.is_deleted = 0
          LIMIT 1
        `,
        taskId,
      );

      const task = rows[0] || null;
      if (!task) {
        return null;
      }

      return {
        ...task,
        enterpriseName: task.enterpriseName || '-',
        intentArea:
          task.intentArea === null || task.intentArea === undefined
            ? null
            : Number(task.intentArea),
        registerCapital:
          task.registerCapital === null || task.registerCapital === undefined
            ? null
            : Number(task.registerCapital),
        totalScore: Number(task.totalScore || 0),
      };
    });

    if (!result) {
      return badRequestResponse('触达任务不存在', event, 404);
    }

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get radar outreach task detail failed:', error);
    return serverErrorResponse('获取雷达触达任务详情失败', event);
  }
});

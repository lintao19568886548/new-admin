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

  const leadId = Number(event.context.params?.id);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return badRequestResponse('leadId 无效', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      const leadRows = await prismaClient.$queryRawUnsafe<any[]>(
        `
          SELECT
            l.lead_id AS leadId,
            l.enterprise_id AS enterpriseId,
            l.park_id AS parkId,
            l.lead_source AS leadSource,
            l.intent_area AS intentArea,
            l.intent_score AS intentScore,
            l.match_score AS matchScore,
            l.reachable_score AS reachableScore,
            l.total_score AS totalScore,
            l.priority_level AS priorityLevel,
            l.stage AS stage,
            l.owner_user_id AS ownerUserId,
            l.latest_task_id AS latestTaskId,
            l.latest_contact_time AS latestContactTime,
            l.invalid_reason AS invalidReason,
            l.create_time AS createTime,
            l.update_time AS updateTime,
            e.enterprise_name AS enterpriseName,
            e.unified_social_credit_code AS unifiedSocialCreditCode,
            e.phone_number AS phoneNumber,
            e.contact_name AS contactName,
            e.industry_name AS industryName,
            e.address,
            e.city,
            e.register_capital AS registerCapital,
            e.source_first AS sourceFirst,
            e.source_latest AS sourceLatest,
            e.last_signal_time AS latestSignalTime,
            p.park_name AS parkName,
            COALESCE(u.real_name, u.username) AS ownerName
          FROM investment_lead l
          LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
          LEFT JOIN park p ON p.park_id = l.park_id
          LEFT JOIN user u ON u.id = l.owner_user_id
          WHERE l.lead_id = ? AND l.is_deleted = 0
          LIMIT 1
        `,
        leadId,
      );

      const lead = leadRows[0] || null;
      if (!lead) {
        return null;
      }

      const [orderedLeadRows, outreachTasks, collectTaskRows] =
        await Promise.all([
          prismaClient.$queryRawUnsafe<any[]>(
            `
            SELECT
              l.lead_id AS leadId,
              e.enterprise_name AS enterpriseName,
              l.total_score AS totalScore,
              l.stage AS stage
            FROM investment_lead l
            LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
            WHERE l.is_deleted = 0
            ORDER BY l.total_score DESC, l.update_time DESC
          `,
          ),
          prismaClient.$queryRawUnsafe<any[]>(
            `
            SELECT
              t.task_id AS taskId,
              t.task_type AS taskType,
              t.channel,
              t.phone_number AS phoneNumber,
              t.status,
              t.template_code AS templateCode,
              t.scheduled_at AS scheduledAt,
              t.sent_at AS sentAt,
              COALESCE(u.real_name, u.username) AS sentByName,
              t.result_code AS resultCode,
              t.result_message AS resultMessage,
              t.reply_status AS replyStatus,
              t.reply_content AS replyContent,
              t.reply_time AS replyTime,
              t.create_time AS createTime,
              t.update_time AS updateTime
            FROM investment_outreach_task t
            LEFT JOIN user u ON u.id = t.sent_by
            WHERE t.lead_id = ?
            ORDER BY t.create_time DESC, t.task_id DESC
            LIMIT 20
          `,
            leadId,
          ),
          lead.latestTaskId
            ? prismaClient.$queryRawUnsafe<any[]>(
                `
                SELECT
                  task_id AS taskId,
                  status,
                  created,
                  updated,
                  skipped,
                  total,
                  duration_ms AS durationMs,
                  error_reason AS errorReason,
                  started_at AS startedAt,
                  completed_at AS completedAt
                FROM investment_radar_collect_task
                WHERE task_id = ?
                LIMIT 1
              `,
                String(lead.latestTaskId),
              )
            : Promise.resolve([]),
        ]);

      const currentLeadIndex = orderedLeadRows.findIndex(
        (item) => Number(item.leadId) === leadId,
      );
      const previousLead =
        currentLeadIndex > 0 ? orderedLeadRows[currentLeadIndex - 1] : null;
      const nextLead =
        currentLeadIndex >= 0 && currentLeadIndex < orderedLeadRows.length - 1
          ? orderedLeadRows[currentLeadIndex + 1]
          : null;

      return {
        ...lead,
        collectTask: collectTaskRows[0] || null,
        intentArea:
          lead.intentArea === null || lead.intentArea === undefined
            ? null
            : Number(lead.intentArea),
        outreachSummary: {
          count: outreachTasks.length,
          latestSentAt: outreachTasks[0]?.sentAt || null,
        },
        outreachTasks,
        navigation: {
          nextLead: nextLead
            ? {
                enterpriseName: nextLead.enterpriseName || '-',
                leadId: Number(nextLead.leadId),
                stage: nextLead.stage || '',
                totalScore: Number(nextLead.totalScore || 0),
              }
            : null,
          previousLead: previousLead
            ? {
                enterpriseName: previousLead.enterpriseName || '-',
                leadId: Number(previousLead.leadId),
                stage: previousLead.stage || '',
                totalScore: Number(previousLead.totalScore || 0),
              }
            : null,
        },
        registerCapital:
          lead.registerCapital === null || lead.registerCapital === undefined
            ? null
            : Number(lead.registerCapital),
      };
    });

    if (!result) {
      return badRequestResponse('线索不存在', event, 404);
    }

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get radar lead detail failed:', error);
    return serverErrorResponse('获取雷达线索详情失败', event);
  }
});

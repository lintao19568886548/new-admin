import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

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
    const status = String(query.status || '').trim();
    const replyStatus = String(query.replyStatus || '').trim();
    const channel = String(query.channel || '').trim();
    const taskType = String(query.taskType || '').trim();
    const stage = String(query.stage || '').trim();
    const priorityLevel = String(query.priorityLevel || '').trim();

    const result = await runWithRadarSharedScope(async () => {
      const whereClauses = ['l.is_deleted = 0'];
      const whereParams: any[] = [];

      if (status) {
        whereClauses.push('t.status = ?');
        whereParams.push(status);
      }
      if (replyStatus) {
        whereClauses.push('t.reply_status = ?');
        whereParams.push(replyStatus);
      }
      if (channel) {
        whereClauses.push('t.channel = ?');
        whereParams.push(channel);
      }
      if (taskType) {
        whereClauses.push('t.task_type = ?');
        whereParams.push(taskType);
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
          '(e.enterprise_name LIKE ? OR e.phone_number LIKE ? OR t.phone_number LIKE ? OR p.park_name LIKE ? OR t.template_code LIKE ?)',
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
        FROM investment_outreach_task t
        INNER JOIN investment_lead l ON l.lead_id = t.lead_id
        LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
        LEFT JOIN park p ON p.park_id = l.park_id
        LEFT JOIN user u ON u.id = t.sent_by
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
            callTasks: bigint | number;
            failedTasks: bigint | number;
            pendingTasks: bigint | number;
            positiveReplies: bigint | number;
            repliedTasks: bigint | number;
            sentTasks: bigint | number;
            smsTasks: bigint | number;
            totalTasks: bigint | number;
          }>
        >(
          `
            SELECT
              COUNT(*) AS totalTasks,
              SUM(CASE WHEN t.status IN ('PENDING', 'RUNNING') THEN 1 ELSE 0 END) AS pendingTasks,
              SUM(CASE WHEN t.status IN ('SENT', 'SUCCESS', 'REPLIED') THEN 1 ELSE 0 END) AS sentTasks,
              SUM(CASE WHEN t.status IN ('FAILED', 'ERROR') THEN 1 ELSE 0 END) AS failedTasks,
              SUM(CASE WHEN t.reply_status IN ('REPLIED', 'POSITIVE', 'NEGATIVE') THEN 1 ELSE 0 END) AS repliedTasks,
              SUM(CASE WHEN t.reply_status = 'POSITIVE' THEN 1 ELSE 0 END) AS positiveReplies,
              SUM(CASE WHEN t.channel = 'SMS' THEN 1 ELSE 0 END) AS smsTasks,
              SUM(CASE WHEN t.channel = 'CALL' THEN 1 ELSE 0 END) AS callTasks
            ${fromSql}
            ${whereSql}
          `,
          ...whereParams,
        ),
        prismaClient.$queryRawUnsafe<any[]>(
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
              COALESCE(u.real_name, u.username) AS sentByName,
              t.result_code AS resultCode,
              t.result_message AS resultMessage,
              t.reply_status AS replyStatus,
              t.reply_content AS replyContent,
              t.reply_time AS replyTime,
              t.create_time AS createTime,
              t.update_time AS updateTime,
              e.enterprise_name AS enterpriseName,
              e.contact_name AS contactName,
              e.source_latest AS latestSignalType,
              p.park_name AS parkName,
              l.priority_level AS priorityLevel,
              l.stage,
              l.total_score AS totalScore,
              l.latest_contact_time AS latestContactTime
            ${fromSql}
            ${whereSql}
            ORDER BY
              CASE
                WHEN t.status IN ('PENDING', 'RUNNING') THEN 0
                WHEN t.reply_status = 'POSITIVE' THEN 1
                WHEN t.reply_status IN ('REPLIED', 'NEGATIVE') THEN 2
                WHEN t.status IN ('SENT', 'SUCCESS', 'REPLIED') THEN 3
                ELSE 4
              END,
              COALESCE(t.scheduled_at, t.sent_at, t.create_time) DESC,
              t.task_id DESC
            LIMIT ? OFFSET ?
          `,
          ...whereParams,
          pageSize,
          offset,
        ),
      ]);

      const total = Number(countRows[0]?.total || 0);
      const summary = summaryRows[0] || {
        callTasks: 0,
        failedTasks: 0,
        pendingTasks: 0,
        positiveReplies: 0,
        repliedTasks: 0,
        sentTasks: 0,
        smsTasks: 0,
        totalTasks: 0,
      };

      return {
        items: rows.map((item) => ({
          ...item,
          enterpriseName: item.enterpriseName || '-',
          totalScore: Number(item.totalScore || 0),
        })),
        page: {
          currentPage,
          pageSize,
          total,
        },
        summary: {
          callTasks: Number(summary.callTasks || 0),
          failedTasks: Number(summary.failedTasks || 0),
          pendingTasks: Number(summary.pendingTasks || 0),
          positiveReplies: Number(summary.positiveReplies || 0),
          repliedTasks: Number(summary.repliedTasks || 0),
          sentTasks: Number(summary.sentTasks || 0),
          smsTasks: Number(summary.smsTasks || 0),
          totalTasks: Number(summary.totalTasks || 0),
        },
        total,
      };
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get radar outreach task list failed:', error);
    return serverErrorResponse('获取雷达触达任务列表失败', event);
  }
});

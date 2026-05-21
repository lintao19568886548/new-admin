import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { ensureFollowRecordTable } from '~/utils/investment-radar/sop-record-service';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

const allowedStages = new Set(['DEAL', 'INVALID']);

async function tableExists(tableName: string) {
  const rows = await prismaClient.$queryRawUnsafe<Array<{ count: bigint }>>(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    tableName,
  );
  return Number(rows[0]?.count || 0) > 0;
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

  const body = await readBody<Record<string, unknown>>(event);
  const stage = String(body.stage || '')
    .trim()
    .toUpperCase();
  if (!allowedStages.has(stage)) {
    return badRequestResponse('线索阶段无效', event);
  }

  const reason = String(body.reason || '').trim();
  if (stage === 'INVALID' && !reason) {
    return badRequestResponse('请填写失效原因', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      await ensureFollowRecordTable();
      const hasSopReminderTable = await tableExists('investment_sop_reminder');
      const hasOutreachTaskTable = await tableExists(
        'investment_outreach_task',
      );
      const stageLabel = stage === 'DEAL' ? '成交' : '失效';
      const finalReason =
        reason || (stage === 'DEAL' ? '客户已成交' : '线索已失效');

      const leadRows = await prismaClient.$queryRawUnsafe<
        Array<{ leadId: bigint; stage: string }>
      >(
        `
          SELECT lead_id AS leadId, stage
          FROM investment_lead
          WHERE lead_id = ? AND is_deleted = 0
          LIMIT 1
        `,
        leadId,
      );
      const lead = leadRows[0];
      if (!lead) {
        throw new Error('线索不存在');
      }

      await prismaClient.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `
            UPDATE investment_lead
            SET
              stage = ?,
              invalid_reason = CASE WHEN ? = 'INVALID' THEN ? ELSE NULL END,
              update_time = NOW(3)
            WHERE lead_id = ?
          `,
          stage,
          stage,
          finalReason,
          leadId,
        );

        await tx.$executeRawUnsafe(
          `
            INSERT INTO investment_follow_record
              (lead_id, follow_type, follow_result, content, next_action, next_follow_time, operator_user_id, create_time)
            VALUES
              (?, 'VISIT', ?, ?, NULL, NULL, ?, NOW(3))
          `,
          leadId,
          stage === 'DEAL' ? 'POSITIVE' : 'INVALID',
          `${stageLabel}：${finalReason}`,
          Number(userinfo.id),
        );

        if (hasSopReminderTable) {
          await tx.$executeRawUnsafe(
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

        if (hasOutreachTaskTable) {
          await tx.$executeRawUnsafe(
            `
              UPDATE investment_outreach_task
              SET
                status = 'CANCELED',
                result_code = 'LEAD_CLOSED',
                result_message = ?,
                update_time = NOW(3)
              WHERE lead_id = ?
              AND status IN ('PENDING', 'SCHEDULED', 'RUNNING')
            `,
            `线索已${stageLabel}，未执行触达已自动取消`,
            leadId,
          );
        }
      });

      return {
        invalidReason: stage === 'INVALID' ? finalReason : null,
        leadId,
        stage,
        updateTime: new Date().toISOString(),
      };
    });

    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('close radar lead failed:', error);
    if (error.message?.includes('线索不存在')) {
      return badRequestResponse(error.message, event, 404);
    }
    return serverErrorResponse('更新线索转化结果失败', event);
  }
});

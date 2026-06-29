import { prismaClient } from '~/utils/db';
import { inferContactRestrictionFromReply } from '~/utils/investment-radar/contact-restriction-policy';
import {
  ensureContactRestrictionTable,
  upsertContactRestriction,
} from '~/utils/investment-radar/contact-restriction-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

const allowedReplyStatuses = new Set([
  'BLACKLIST',
  'NEGATIVE',
  'POSITIVE',
  'REPLIED',
  'UNSUBSCRIBED',
]);

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const taskId = Number(event.context.params?.id);
  if (!Number.isFinite(taskId) || taskId <= 0) {
    return badRequestResponse('taskId 无效', event);
  }

  const body = await readBody<Record<string, unknown>>(event);
  const replyStatus = String(body.replyStatus || '').trim();
  if (!allowedReplyStatuses.has(replyStatus)) {
    return badRequestResponse('replyStatus 无效', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      await prismaClient.$transaction(async (tx) => {
        await ensureContactRestrictionTable();
        const taskRows = await tx.$queryRawUnsafe<any[]>(
          `
            SELECT
              t.lead_id AS leadId,
              t.phone_number AS phoneNumber,
              t.status,
              l.enterprise_id AS enterpriseId
            FROM investment_outreach_task t
            LEFT JOIN investment_lead l ON l.lead_id = t.lead_id
            WHERE t.task_id = ?
            LIMIT 1
          `,
          taskId,
        );
        const task = taskRows[0];
        if (!task) {
          throw new Error('触达任务不存在');
        }

        const taskStatus = String(task.status || '');
        if (!['SENT', 'SUCCESS'].includes(taskStatus)) {
          throw new Error('请先发送触达任务，再记录回复');
        }

        await tx.$executeRawUnsafe(
          `
            UPDATE investment_outreach_task
            SET
              status = 'REPLIED',
              reply_status = ?,
              reply_content = ?,
              reply_time = NOW(3),
              update_time = NOW(3)
            WHERE task_id = ?
          `,
          replyStatus,
          String(body.replyContent || '').trim() || null,
          taskId,
        );

        const leadId = Number(task.leadId || 0);
        if (leadId > 0 && replyStatus === 'POSITIVE') {
          await tx.$executeRawUnsafe(
            `
              UPDATE investment_lead
              SET
                latest_contact_time = COALESCE(latest_contact_time, NOW(3)),
                stage = CASE
                  WHEN stage IN ('PENDING_CONTACT', 'CONTACTED') THEN 'REPLIED'
                  ELSE stage
                END,
                update_time = NOW(3)
              WHERE lead_id = ?
            `,
            leadId,
          );
        } else if (leadId > 0) {
          await tx.$executeRawUnsafe(
            `
              UPDATE investment_lead
              SET
                latest_contact_time = COALESCE(latest_contact_time, NOW(3)),
                stage = CASE
                  WHEN stage = 'PENDING_CONTACT' THEN 'CONTACTED'
                  ELSE stage
                END,
                update_time = NOW(3)
              WHERE lead_id = ?
            `,
            leadId,
          );
        }

        const restriction = inferContactRestrictionFromReply({
          replyContent: String(body.replyContent || '').trim(),
          replyStatus,
        });
        if (leadId > 0 && restriction) {
          await upsertContactRestriction({
            enterpriseId: Number(task.enterpriseId || 0) || null,
            leadId,
            phoneNumber: task.phoneNumber || null,
            reason: restriction.reason,
            restrictionType: restriction.restrictionType,
          });
        }
      });

      return {
        replyContent: String(body.replyContent || ''),
        replyStatus,
        replyTime: new Date().toISOString(),
        taskId,
      };
    });

    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('reply outreach task failed:', error);
    if (error.message?.includes('不存在')) {
      return badRequestResponse(error.message, event, 404);
    }
    if (error.message?.includes('先发送')) {
      return badRequestResponse(error.message, event);
    }
    return serverErrorResponse('记录触达回复失败', event);
  }
});

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

  const taskId = Number(event.context.params?.id);
  if (!Number.isFinite(taskId) || taskId <= 0) {
    return badRequestResponse('taskId 无效', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      await prismaClient.$transaction(async (tx) => {
        const taskRows = await tx.$queryRawUnsafe<any[]>(
          `
            SELECT lead_id, status
            FROM investment_outreach_task
            WHERE task_id = ?
            LIMIT 1
          `,
          taskId,
        );
        const task = taskRows[0];
        if (!task) {
          throw new Error('触达任务不存在');
        }

        const taskStatus = String(task.status || '');
        if (!['PENDING', 'RUNNING'].includes(taskStatus)) {
          throw new Error('当前任务状态不允许模拟发送');
        }

        await tx.$executeRawUnsafe(
          `
            UPDATE investment_outreach_task
            SET
              status = 'SENT',
              sent_at = NOW(3),
              sent_by = ?,
              result_code = 'SUCCESS',
              result_message = '模拟发送成功',
              update_time = NOW(3)
            WHERE task_id = ?
          `,
          Number(userinfo.id),
          taskId,
        );

        const leadId = Number(task.lead_id || 0);
        if (leadId > 0) {
          await tx.$executeRawUnsafe(
            `
              UPDATE investment_lead
              SET
                latest_contact_time = NOW(3),
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
      });

      return {
        resultCode: 'SUCCESS',
        resultMessage: '模拟发送成功',
        sentAt: new Date().toISOString(),
        sentBy: Number(userinfo.id),
        status: 'SENT',
        taskId,
      };
    });

    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('mock send outreach task failed:', error);
    if (error.message?.includes('不存在')) {
      return badRequestResponse(error.message, event, 404);
    }
    if (error.message?.includes('不允许')) {
      return badRequestResponse(error.message, event);
    }
    return serverErrorResponse('模拟发送触达任务失败', event);
  }
});

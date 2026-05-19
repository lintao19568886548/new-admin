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

  const body = await readBody<Record<string, unknown>>(event);
  const leadId = Number(body.leadId);
  const phoneNumber = String(body.phoneNumber || '').trim();
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return badRequestResponse('leadId 无效', event);
  }
  if (!phoneNumber) {
    return badRequestResponse('触达号码不能为空', event);
  }

  try {
    const task = await runWithRadarSharedScope(async () => {
      const taskId = await prismaClient.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `
            INSERT INTO investment_outreach_task
              (lead_id, task_type, channel, phone_number, status, template_code, scheduled_at, result_code, result_message, reply_status, sent_by, create_time, update_time)
            VALUES
              (?, ?, ?, ?, 'PENDING', ?, NOW(3), NULL, ?, 'NO_REPLY', ?, NOW(3), NOW(3))
          `,
          leadId,
          String(body.taskType || 'OUTREACH'),
          String(body.channel || 'SMS'),
          phoneNumber,
          String(body.templateCode || '').trim() || null,
          String(body.content || '').trim() || null,
          Number(userinfo.id),
        );

        const rows = await tx.$queryRawUnsafe<Array<{ taskId: bigint }>>(
          'SELECT LAST_INSERT_ID() AS taskId',
        );
        return Number(rows[0]?.taskId || 0);
      });

      return {
        channel: String(body.channel || 'SMS'),
        content: String(body.content || ''),
        createTime: new Date().toISOString(),
        leadId,
        phoneNumber,
        status: 'PENDING',
        taskId,
        taskType: String(body.taskType || 'OUTREACH'),
        templateCode: String(body.templateCode || ''),
      };
    });

    return useResponseSuccess(task);
  } catch (error) {
    console.error('create outreach task failed:', error);
    return serverErrorResponse('创建触达任务失败', event);
  }
});

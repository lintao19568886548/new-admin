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
    await runWithRadarSharedScope(async () => {
      await prismaClient.$executeRawUnsafe(
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
    });

    return useResponseSuccess({
      resultCode: 'SUCCESS',
      resultMessage: '模拟发送成功',
      sentAt: new Date().toISOString(),
      sentBy: Number(userinfo.id),
      status: 'SENT',
      taskId,
    });
  } catch (error) {
    console.error('mock send outreach task failed:', error);
    return serverErrorResponse('模拟发送触达任务失败', event);
  }
});

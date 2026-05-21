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
            SELECT status
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
          throw new Error('仅待执行任务允许取消');
        }

        await tx.$executeRawUnsafe(
          `
            UPDATE investment_outreach_task
            SET
              status = 'CANCELED',
              result_code = 'CANCELED',
              result_message = '任务已取消',
              update_time = NOW(3)
            WHERE task_id = ?
          `,
          taskId,
        );
      });

      return {
        resultCode: 'CANCELED',
        resultMessage: '任务已取消',
        status: 'CANCELED',
        taskId,
      };
    });

    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('cancel outreach task failed:', error);
    if (error.message?.includes('不存在')) {
      return badRequestResponse(error.message, event, 404);
    }
    if (error.message?.includes('允许取消')) {
      return badRequestResponse(error.message, event);
    }
    return serverErrorResponse('取消触达任务失败', event);
  }
});

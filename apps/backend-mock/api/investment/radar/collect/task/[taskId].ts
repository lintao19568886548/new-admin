import { prismaClient } from '~/utils/db';
import { ensureRadarCollectTaskStorage } from '~/utils/investment-radar/public-opportunity-repository';
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

  const taskId = String(event.context.params?.taskId || '').trim();
  if (!taskId) {
    return badRequestResponse('taskId 无效', event);
  }

  try {
    const rows = await runWithRadarSharedScope(async () => {
      await ensureRadarCollectTaskStorage();

      return prismaClient.$queryRawUnsafe<any[]>(
        `
          SELECT
            task_id AS taskId,
            status,
            created,
            updated,
            skipped,
            duration_ms AS durationMs,
            error_reason AS errorReason
          FROM investment_radar_collect_task
          WHERE task_id = ?
          LIMIT 1
        `,
        taskId,
      );
    });

    const task = rows[0] || null;
    if (!task) {
      return badRequestResponse('采集任务不存在', event, 404);
    }

    return useResponseSuccess(task);
  } catch (error) {
    console.error('get radar collect task failed:', error);
    return serverErrorResponse('获取采集任务失败', event);
  }
});

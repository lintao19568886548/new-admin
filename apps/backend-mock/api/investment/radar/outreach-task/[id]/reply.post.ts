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

  const body = await readBody<Record<string, unknown>>(event);
  const replyStatus = String(body.replyStatus || '').trim();
  if (!replyStatus) {
    return badRequestResponse('replyStatus 不能为空', event);
  }

  try {
    await runWithRadarSharedScope(async () => {
      await prismaClient.$executeRawUnsafe(
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
    });

    return useResponseSuccess({
      replyContent: String(body.replyContent || ''),
      replyStatus,
      replyTime: new Date().toISOString(),
      taskId,
    });
  } catch (error) {
    console.error('reply outreach task failed:', error);
    return serverErrorResponse('记录触达回复失败', event);
  }
});

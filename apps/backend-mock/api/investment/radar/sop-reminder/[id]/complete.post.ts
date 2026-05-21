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

  const reminderId = Number(event.context.params?.id);
  if (!Number.isFinite(reminderId) || reminderId <= 0) {
    return badRequestResponse('reminderId 无效', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () => {
      const reminderRows = await prismaClient.$queryRawUnsafe<any[]>(
        `
          SELECT reminder_status AS reminderStatus
          FROM investment_sop_reminder
          WHERE reminder_id = ?
          LIMIT 1
        `,
        reminderId,
      );
      const reminder = reminderRows[0];
      if (!reminder) {
        throw new Error('提醒不存在');
      }

      if (reminder.reminderStatus === 'DONE') {
        return {
          handledTime: new Date().toISOString(),
          reminderId,
          status: 'DONE',
        };
      }

      await prismaClient.$executeRawUnsafe(
        `
          UPDATE investment_sop_reminder
          SET
            reminder_status = 'DONE',
            handled_time = NOW(3),
            update_time = NOW(3)
          WHERE reminder_id = ?
          AND reminder_status IN ('PENDING', 'OVERDUE')
        `,
        reminderId,
      );

      return {
        handledTime: new Date().toISOString(),
        reminderId,
        status: 'DONE',
      };
    });

    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('complete sop reminder failed:', error);
    if (error.message?.includes('不存在')) {
      return badRequestResponse(error.message, event, 404);
    }
    return serverErrorResponse('完成提醒失败', event);
  }
});

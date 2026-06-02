import { sendOutreachTask } from '~/utils/investment-radar/outreach-delivery-service';
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
    const result = await runWithRadarSharedScope(() =>
      sendOutreachTask(taskId, Number(userinfo.id)),
    );
    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('send outreach task failed:', error);
    if (error.message?.includes('不存在')) {
      return badRequestResponse(error.message, event, 404);
    }
    if (
      error.message?.includes('不允许') ||
      error.message?.includes('内容为空')
    ) {
      return badRequestResponse(error.message, event);
    }
    return serverErrorResponse('发送触达任务失败', event);
  }
});

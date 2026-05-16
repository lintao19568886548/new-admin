import {
  cancelCrawlerTask,
  CrawlerTaskValidationError,
} from '~/utils/investment-radar/crawler-task-repository';
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
      cancelCrawlerTask(taskId),
    );
    if (!result) {
      return badRequestResponse('采集任务不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof CrawlerTaskValidationError) {
      return badRequestResponse(error.message, event);
    }
    console.error('cancel crawler task failed:', error);
    return serverErrorResponse('取消采集任务失败', event);
  }
});

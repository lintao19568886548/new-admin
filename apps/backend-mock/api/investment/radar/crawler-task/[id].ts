import { getCrawlerTaskDetail } from '~/utils/investment-radar/crawler-task-repository';
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
      getCrawlerTaskDetail(taskId),
    );
    if (!result) {
      return badRequestResponse('采集任务不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('get crawler task detail failed:', error);
    return serverErrorResponse('获取采集任务详情失败', event);
  }
});

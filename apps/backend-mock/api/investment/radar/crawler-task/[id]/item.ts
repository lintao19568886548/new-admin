import { listCrawlerTaskItems } from '~/utils/investment-radar/crawler-task-item-repository';
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
    const query = getQuery(event);
    const currentPage = Math.max(1, Number(query.currentPage || 1));
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));
    const sourceId = Number(query.sourceId || 0);
    const status = String(query.status || '').trim();
    const result = await runWithRadarSharedScope(async () => {
      const task = await getCrawlerTaskDetail(taskId);
      if (!task) {
        return null;
      }
      return listCrawlerTaskItems({
        currentPage,
        pageSize,
        sourceId: sourceId > 0 ? sourceId : undefined,
        status: status || undefined,
        taskId,
      });
    });
    if (!result) {
      return badRequestResponse('采集任务不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('list crawler task items failed:', error);
    return serverErrorResponse('获取采集 URL 项失败', event);
  }
});

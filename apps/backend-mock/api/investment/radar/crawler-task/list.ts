import { listCrawlerTasks } from '~/utils/investment-radar/crawler-task-repository';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const currentPage = Math.max(1, Number(query.currentPage || 1));
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));
    const sourceId = Number(query.sourceId || 0);
    const status = String(query.status || '').trim();
    const result = await runWithRadarSharedScope(() =>
      listCrawlerTasks({
        currentPage,
        pageSize,
        sourceId: sourceId > 0 ? sourceId : undefined,
        status,
      }),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('list crawler tasks failed:', error);
    return serverErrorResponse('获取采集任务列表失败', event);
  }
});

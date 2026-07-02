import { listAgentTasks } from '~/utils/agent/task-repository';
import { verifyAccessToken } from '~/utils/jwt-utils';
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

  const query = getQuery(event);
  const page = Number(query.currentPage || query.page || 1);
  const pageSize = Number(query.pageSize || 20);
  const status = String(query.status || '').trim();

  try {
    const result = await listAgentTasks({
      page,
      pageSize,
      status: status || undefined,
      userId: userinfo.id,
    });
    return useResponseSuccess(result);
  } catch (error: any) {
    return serverErrorResponse(
      String(error?.message || '获取 Agent 任务列表失败'),
      event,
    );
  }
});

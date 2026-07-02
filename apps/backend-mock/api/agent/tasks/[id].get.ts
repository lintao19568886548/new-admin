import { getAgentTaskDetail } from '~/utils/agent/task-repository';
import { verifyAccessToken } from '~/utils/jwt-utils';
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

  const taskId = String(event.context.params?.id || '').trim();
  if (!taskId) {
    return badRequestResponse('任务ID不能为空', event);
  }

  try {
    const detail = await getAgentTaskDetail({
      taskId,
      userId: userinfo.id,
    });
    if (!detail) {
      return badRequestResponse('任务不存在或无权访问', event, 404);
    }
    return useResponseSuccess(detail);
  } catch (error: any) {
    return serverErrorResponse(
      String(error?.message || '获取 Agent 任务详情失败'),
      event,
    );
  }
});

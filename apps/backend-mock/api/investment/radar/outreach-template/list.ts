import { listOutreachTemplates } from '~/utils/investment-radar/outreach-template-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
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

  try {
    const query = getQuery(event);
    const result = await runWithRadarSharedScope(async () =>
      listOutreachTemplates({
        approvalStatus: String(query.approvalStatus || '').trim(),
        channel: String(query.channel || '').trim(),
        currentPage: Number(query.currentPage || 1),
        enabled: String(query.enabled || 'ALL').trim(),
        keyword: String(query.keyword || '').trim(),
        pageSize: Number(query.pageSize || 20),
        taskType: String(query.taskType || '').trim(),
      }),
    );

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get outreach template list failed:', error);
    return serverErrorResponse('获取触达模板列表失败', event);
  }
});

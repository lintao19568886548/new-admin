import { runPublicOpportunityCollectTask } from '~/utils/investment-radar/public-opportunity-repository';
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
    const result = await runWithRadarSharedScope(() =>
      runPublicOpportunityCollectTask(),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('create radar collect task failed:', error);
    return serverErrorResponse('创建智能招商采集任务失败', event);
  }
});

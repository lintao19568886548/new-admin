import { getOutreachTemplateStats } from '~/utils/investment-radar/outreach-template-service';
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
    const items = await runWithRadarSharedScope(() =>
      getOutreachTemplateStats(),
    );
    return useResponseSuccess({ items, total: items.length });
  } catch (error) {
    console.error('get outreach template stats failed:', error);
    return serverErrorResponse('获取触达模板统计失败', event);
  }
});

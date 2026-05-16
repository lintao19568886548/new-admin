import { setCrawlerSourceEnabled } from '~/utils/investment-radar/crawler-source-repository';
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

  const sourceId = Number(event.context.params?.id);
  if (!Number.isFinite(sourceId) || sourceId <= 0) {
    return badRequestResponse('sourceId 无效', event);
  }

  try {
    const result = await runWithRadarSharedScope(() =>
      setCrawlerSourceEnabled(sourceId, true),
    );
    if (!result) {
      return badRequestResponse('采集数据源不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('enable crawler source failed:', error);
    return serverErrorResponse('启用采集数据源失败', event);
  }
});

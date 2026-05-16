import { listCrawlerSources } from '~/utils/investment-radar/crawler-source-repository';
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
    const result = await runWithRadarSharedScope(() => listCrawlerSources());
    return useResponseSuccess(result);
  } catch (error) {
    console.error('list crawler sources failed:', error);
    return serverErrorResponse('获取采集数据源列表失败', event);
  }
});

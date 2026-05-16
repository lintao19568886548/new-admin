import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { listSignalEvents } from '~/utils/investment-radar/signal-event-repository';
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
    const result = await runWithRadarSharedScope(() =>
      listSignalEvents({
        companyName: String(query.companyName || '').trim(),
        currentPage,
        eventType: String(query.eventType || '').trim(),
        keyword: String(query.keyword || '').trim(),
        pageSize,
        sourceName: String(query.sourceName || '').trim(),
        sourceType: String(query.sourceType || '').trim(),
        status: String(query.status || '').trim(),
      }),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('list signal events failed:', error);
    return serverErrorResponse('获取企业信号列表失败', event);
  }
});

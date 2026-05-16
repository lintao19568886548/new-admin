import { listExternalLeads } from '~/utils/investment-radar/external-lead-repository';
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
    const result = await runWithRadarSharedScope(() =>
      listExternalLeads({
        confidenceLevel: String(query.confidenceLevel || '').trim(),
        currentPage,
        demandType: String(query.demandType || '').trim(),
        industryName: String(query.industryName || '').trim(),
        keyword: String(query.keyword || '').trim(),
        pageSize,
        regionCity: String(query.regionCity || '').trim(),
        sourceName: String(query.sourceName || '').trim(),
        status: String(query.status || '').trim(),
      }),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('list external leads failed:', error);
    return serverErrorResponse('获取外部公开线索列表失败', event);
  }
});

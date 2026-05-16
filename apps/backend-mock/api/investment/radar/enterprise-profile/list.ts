import { listEnterpriseProfiles } from '~/utils/investment-radar/enterprise-profile-repository';
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
      listEnterpriseProfiles({
        currentPage,
        industryName: String(query.industryName || '').trim(),
        keyword: String(query.keyword || '').trim(),
        pageSize,
        regionCity: String(query.regionCity || '').trim(),
      }),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('list enterprise profiles failed:', error);
    return serverErrorResponse('获取企业画像列表失败', event);
  }
});

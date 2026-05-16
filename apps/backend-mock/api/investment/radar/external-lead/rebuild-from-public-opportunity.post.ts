import { rebuildExternalLeadsFromPublicOpportunity } from '~/utils/investment-radar/public-opportunity-lead-rebuilder';
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
      rebuildExternalLeadsFromPublicOpportunity(),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error(
      'rebuild external leads from public opportunity failed:',
      error,
    );
    return serverErrorResponse('从公开机会池重建外部线索失败', event);
  }
});

import { rebuildEnterpriseProfilesFromSignals } from '~/utils/investment-radar/enterprise-profile-repository';
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
      rebuildEnterpriseProfilesFromSignals(),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('rebuild enterprise profiles failed:', error);
    return serverErrorResponse('重建 demo 企业画像失败', event);
  }
});

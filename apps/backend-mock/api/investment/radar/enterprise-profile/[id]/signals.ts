import { listEnterpriseProfileSignals } from '~/utils/investment-radar/enterprise-profile-repository';
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

  const profileId = Number(event.context.params?.id);
  if (!Number.isFinite(profileId) || profileId <= 0) {
    return badRequestResponse('profileId 无效', event);
  }

  try {
    const result = await runWithRadarSharedScope(() =>
      listEnterpriseProfileSignals(profileId),
    );
    if (!result) {
      return badRequestResponse('企业画像不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('list enterprise profile signals failed:', error);
    return serverErrorResponse('获取企业画像信号失败', event);
  }
});

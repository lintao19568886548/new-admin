import { eventHandler, getRouterParam } from 'h3';
import { performPropertyMatch } from '~/utils/investment-radar/property-match-service';
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

  const leadId = Number(getRouterParam(event, 'id'));

  if (!Number.isFinite(leadId) || leadId <= 0) {
    return badRequestResponse('leadId 无效', event);
  }

  try {
    const matches = await runWithRadarSharedScope(() =>
      performPropertyMatch(leadId, {
        authorizedParkIds: userinfo.parks.map((park) => park.parkId),
      }),
    );
    return useResponseSuccess(matches);
  } catch (error) {
    console.error('get property match failed:', error);
    return serverErrorResponse('获取房源匹配失败', event);
  }
});

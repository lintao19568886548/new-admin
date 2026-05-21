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

    return useResponseSuccess({
      matches,
      rebuiltAt: new Date().toISOString(),
      totalCount: matches.length,
    });
  } catch (error) {
    console.error('rebuild property match failed:', error);
    return serverErrorResponse('房源匹配重新计算失败', event);
  }
});

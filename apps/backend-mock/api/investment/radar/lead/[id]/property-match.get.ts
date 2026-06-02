import { eventHandler, getRouterParam } from 'h3';
import { prismaClient } from '~/utils/db';
import { getSavedOrBuildPropertyMatches } from '~/utils/investment-radar/property-match-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

function isMissingPropertyMatchStorageError(error: unknown) {
  return String((error as Error)?.message || error || '').includes(
    'property_match_result',
  );
}

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
    const matches = await runWithRadarSharedScope(async () => {
      const leadRows = await prismaClient.$queryRawUnsafe<
        Array<{ leadId: bigint | number }>
      >(
        `
          SELECT lead_id AS leadId
          FROM investment_lead
          WHERE lead_id = ? AND is_deleted = 0
          LIMIT 1
        `,
        leadId,
      );
      if (!leadRows[0]) {
        return null;
      }
      return getSavedOrBuildPropertyMatches(leadId, {
        authorizedParkIds: userinfo.parks.map((park) => park.parkId),
      });
    });
    if (matches === null) {
      return badRequestResponse('线索不存在', event, 404);
    }
    return useResponseSuccess(matches);
  } catch (error) {
    if (isMissingPropertyMatchStorageError(error)) {
      console.warn('property match storage unavailable, returning empty list');
      return useResponseSuccess([]);
    }
    console.error('get property match failed:', error);
    return serverErrorResponse('获取房源匹配失败', event);
  }
});

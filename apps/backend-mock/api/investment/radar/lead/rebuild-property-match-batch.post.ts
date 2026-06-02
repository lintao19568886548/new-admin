import { eventHandler, readBody } from 'h3';
import { rebuildPropertyMatchesForLeads } from '~/utils/investment-radar/property-match-service';
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

  const body = await readBody<Record<string, unknown>>(event);
  const limit = Number(body.limit || 200);

  try {
    const result = await runWithRadarSharedScope(() =>
      rebuildPropertyMatchesForLeads(limit),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('batch rebuild property match failed:', error);
    return serverErrorResponse('批量重算房源匹配失败', event);
  }
});

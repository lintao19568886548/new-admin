import type { ContactRestrictionSummary } from '~/utils/investment-radar/contact-restriction-service';

import { listContactRestrictions } from '~/utils/investment-radar/contact-restriction-service';
import {
  checkRadarPermission,
  RADAR_PERMISSION_CODES,
} from '~/utils/investment-radar/crawler-permission-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const permission = checkRadarPermission(
    userinfo,
    RADAR_PERMISSION_CODES.contactRestrictionRead,
  );
  if (!permission.allowed) {
    return forbiddenResponse(event, permission.message);
  }

  try {
    const query = getQuery(event);
    const result = await runWithRadarSharedScope(async () => {
      return await listContactRestrictions({
        currentPage: Number(query.currentPage || 1),
        keyword: String(query.keyword || '').trim(),
        pageSize: Number(query.pageSize || 20),
        restrictionType: String(query.restrictionType || '').trim(),
        status: String(query.status || 'ACTIVE').trim(),
      });
    });

    return useResponseSuccess<
      Awaited<ReturnType<typeof listContactRestrictions>> & {
        summary: ContactRestrictionSummary;
      }
    >(result);
  } catch (error) {
    console.error('get contact restriction list failed:', error);
    return serverErrorResponse('获取触达限制名单失败', event);
  }
});

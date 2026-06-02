import { syncInternalContractExpiryToRadar } from '~/utils/investment-radar/internal-contract-expiry-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

function getAuthorizedParkIds(userinfo: any) {
  return Array.isArray(userinfo?.parks)
    ? userinfo.parks.map((park: any) => Number(park.parkId)).filter(Boolean)
    : [];
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const result = await runWithRadarSharedScope(() =>
      syncInternalContractExpiryToRadar({
        authorizedParkIds: getAuthorizedParkIds(userinfo),
        ownerUserId: Number(
          (userinfo as any).userId || (userinfo as any).id || 0,
        ),
      }),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('sync internal contract expiry failed:', error);
    return serverErrorResponse('同步内部合同到雷达失败', event);
  }
});

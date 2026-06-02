import { runInternalContractExpiryCrawlerTask } from '~/utils/investment-radar/internal-contract-expiry-service';
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
      runInternalContractExpiryCrawlerTask({
        authorizedParkIds: getAuthorizedParkIds(userinfo),
      }),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('run internal contract expiry task failed:', error);
    return serverErrorResponse('运行内部合同到期任务失败', event);
  }
});

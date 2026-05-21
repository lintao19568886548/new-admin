import { rebuildRadarAcquisitionPipeline } from '~/utils/investment-radar/pipeline-service';
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
      rebuildRadarAcquisitionPipeline(),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('rebuild radar acquisition pipeline failed:', error);
    return serverErrorResponse('刷新主动获客链路失败', event);
  }
});

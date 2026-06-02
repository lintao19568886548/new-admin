import { setOutreachTemplateEnabled } from '~/utils/investment-radar/outreach-template-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { verifyAccessToken } from '~/utils/jwt-utils';
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

  const templateId = Number(event.context.params?.id);
  if (!Number.isFinite(templateId) || templateId <= 0) {
    return badRequestResponse('templateId 无效', event);
  }

  try {
    const result = await runWithRadarSharedScope(async () =>
      setOutreachTemplateEnabled(templateId, true),
    );
    if (!result) {
      return badRequestResponse('触达模板不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('enable outreach template failed:', error);
    if (error.message?.includes('未审批通过')) {
      return badRequestResponse(error.message, event);
    }
    return serverErrorResponse('启用触达模板失败', event);
  }
});

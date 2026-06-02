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
      setOutreachTemplateEnabled(templateId, false),
    );
    if (!result) {
      return badRequestResponse('触达模板不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('disable outreach template failed:', error);
    return serverErrorResponse('停用触达模板失败', event);
  }
});

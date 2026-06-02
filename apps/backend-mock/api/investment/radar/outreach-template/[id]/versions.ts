import { listOutreachTemplateVersions } from '~/utils/investment-radar/outreach-template-service';
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
    const items = await runWithRadarSharedScope(() =>
      listOutreachTemplateVersions(templateId),
    );
    return useResponseSuccess({ items, total: items.length });
  } catch (error) {
    console.error('get outreach template versions failed:', error);
    return serverErrorResponse('获取触达模板版本失败', event);
  }
});

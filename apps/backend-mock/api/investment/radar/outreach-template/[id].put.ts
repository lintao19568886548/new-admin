import { updateOutreachTemplate } from '~/utils/investment-radar/outreach-template-service';
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

  const body = await readBody<Record<string, unknown>>(event);

  try {
    const result = await runWithRadarSharedScope(async () =>
      updateOutreachTemplate(templateId, {
        channel: String(body.channel || '').trim(),
        content: String(body.content || '').trim(),
        placeholderJson: Array.isArray(body.placeholderJson)
          ? body.placeholderJson.map((item) => String(item || '').trim())
          : String(body.placeholderJson || '').trim(),
        priorityLevel: String(body.priorityLevel || '').trim(),
        taskType: String(body.taskType || '').trim(),
        templateCode: String(body.templateCode || '').trim(),
        templateName: String(body.templateName || '').trim(),
      }),
    );

    if (!result) {
      return badRequestResponse('触达模板不存在', event, 404);
    }

    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('update outreach template failed:', error);
    if (error.message?.includes('不能为空')) {
      return badRequestResponse(error.message, event);
    }
    if (error.message?.includes('Duplicate')) {
      return badRequestResponse('模板编码已存在', event);
    }
    return serverErrorResponse('更新触达模板失败', event);
  }
});

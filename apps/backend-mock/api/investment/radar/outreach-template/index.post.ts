import { createOutreachTemplate } from '~/utils/investment-radar/outreach-template-service';
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

  const body = await readBody<Record<string, unknown>>(event);

  try {
    const result = await runWithRadarSharedScope(async () =>
      createOutreachTemplate({
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

    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('create outreach template failed:', error);
    if (error.message?.includes('不能为空')) {
      return badRequestResponse(error.message, event);
    }
    if (error.message?.includes('Duplicate')) {
      return badRequestResponse('模板编码已存在', event);
    }
    return serverErrorResponse('创建触达模板失败', event);
  }
});

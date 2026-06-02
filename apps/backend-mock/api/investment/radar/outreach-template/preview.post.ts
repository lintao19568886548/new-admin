import { previewOutreachTemplate } from '~/utils/investment-radar/outreach-template-service';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody<Record<string, unknown>>(event);
  const content = String(body.content || '').trim();
  if (!content) {
    return badRequestResponse('content 不能为空', event);
  }

  return useResponseSuccess(
    previewOutreachTemplate({
      channel: String(body.channel || '').trim(),
      content,
      placeholderJson: Array.isArray(body.placeholderJson)
        ? body.placeholderJson.map((item) => String(item || '').trim())
        : String(body.placeholderJson || '').trim(),
      priorityLevel: String(body.priorityLevel || '').trim(),
      sampleData:
        body.sampleData && typeof body.sampleData === 'object'
          ? (body.sampleData as Record<string, string>)
          : {},
      taskType: String(body.taskType || '').trim(),
      templateCode: String(body.templateCode || '').trim(),
      templateName: String(body.templateName || '').trim(),
    }),
  );
});

import { CrmScmError } from '~/utils/crm-scrm';
import {
  badRequestResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import { exchangeWechatMiniProgramSession } from '~/utils/wechat-miniprogram';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ code?: string }>(event);

  try {
    const session = await exchangeWechatMiniProgramSession(body?.code || '');
    return useResponseSuccess(session);
  } catch (error) {
    if (error instanceof CrmScmError) {
      return error.statusCode >= 500
        ? serverErrorResponse(error.message, event, error.statusCode)
        : badRequestResponse(error.message, event, error.statusCode);
    }
    console.error('[crm] exchange miniprogram session failed:', error);
    return serverErrorResponse('小程序登录失败', event);
  }
});

import { CrmScmError, normalizeCrmPhone } from '~/utils/crm-scrm';
import {
  badRequestResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import { getWechatMiniProgramPhoneNumber } from '~/utils/wechat-miniprogram';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ code?: string }>(event);

  try {
    const result = await getWechatMiniProgramPhoneNumber(body?.code || '');
    return useResponseSuccess({
      phoneNumber: normalizeCrmPhone(result.phoneNumber),
    });
  } catch (error) {
    if (error instanceof CrmScmError) {
      return error.statusCode >= 500
        ? serverErrorResponse(error.message, event, error.statusCode)
        : badRequestResponse(error.message, event, error.statusCode);
    }
    console.error('[crm] get miniprogram phone failed:', error);
    return serverErrorResponse('获取小程序手机号失败', event);
  }
});

import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import { SmsCodeError, verifySmsCode } from '~/utils/sms-code-store';

interface VerifyCodeBody {
  code?: string;
  phoneNumber?: string;
}

export default defineEventHandler(async (event) => {
  // 验证用户是否已登录
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return badRequestResponse('请先登录', event);
  }

  const body = (await readBody(event)) as VerifyCodeBody;
  const phoneNumber = body?.phoneNumber?.trim();
  const code = body?.code?.trim();

  if (!phoneNumber || !code) {
    return badRequestResponse('手机号和验证码均不能为空', event);
  }

  if (!/^\d{11}$/.test(phoneNumber)) {
    return badRequestResponse('请输入 11 位手机号码', event);
  }

  try {
    verifySmsCode(phoneNumber, code);
  } catch (error) {
    if (error instanceof SmsCodeError) {
      return badRequestResponse(error.message, event);
    }

    console.error('校验短信验证码失败:', error);
    return serverErrorResponse('验证码校验失败', event);
  }

  // 验证成功，返回成功响应
  return useResponseSuccess(
    {
      verified: true,
      phoneNumber,
    },
    '验证码校验成功',
  );
});

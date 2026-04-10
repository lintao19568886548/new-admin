import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import { SmsCodeError, verifySmsCode } from '~/utils/sms-code-store';
import { resolveCurrentUserPhoneNumber } from '~/utils/user-service';

interface VerifyCodeBody {
  code?: string;
}

export default defineEventHandler(async (event) => {
  // 验证用户是否已登录
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return badRequestResponse('请先登录', event);
  }

  const body = (await readBody(event)) as VerifyCodeBody;
  const code = body?.code?.trim();
  const phoneNumber = await resolveCurrentUserPhoneNumber({
    phone: userinfo.phone,
    username: userinfo.username,
  });

  if (!code) {
    return badRequestResponse('验证码不能为空', event);
  }

  if (!phoneNumber) {
    return badRequestResponse(
      '当前登录账号未绑定有效手机号，请联系管理员',
      event,
    );
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

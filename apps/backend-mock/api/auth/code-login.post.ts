import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '~/utils/cookie-utils';
import { generateAccessToken, generateRefreshToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  forbiddenResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import { SmsCodeError, verifySmsCode } from '~/utils/sms-code-store';
import { transformPrismaUserToUserInfo } from '~/utils/user-service';

interface CodeLoginBody {
  code?: string;
  phoneNumber?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as CodeLoginBody;
  const phoneNumber = body?.phoneNumber?.trim();
  const code = body?.code?.trim();

  if (!phoneNumber || !code) {
    return badRequestResponse('手机号和验证码均不能为空', event);
  }

  if (!/^\d{11}$/.test(phoneNumber)) {
    return badRequestResponse('请输入11位手机号码', event);
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

  try {
    const userResult = await fetchUserWithDetails(phoneNumber);

    if (!userResult) {
      clearRefreshTokenCookie(event);
      return forbiddenResponse(event, '该手机号未绑定系统账户');
    }

    const userInfo = await transformPrismaUserToUserInfo(userResult);

    const accessToken = generateAccessToken(userInfo);
    const refreshToken = generateRefreshToken(userInfo);

    setRefreshTokenCookie(event, refreshToken);

    return useResponseSuccess({
      ...userInfo,
      accessToken,
    });
  } catch (error) {
    console.error('短信验证码登录失败:', error);
    clearRefreshTokenCookie(event);
    return serverErrorResponse('短信验证码登录失败，请稍后重试', event);
  }
});

import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { sendLoginVerificationCode } from '~/utils/shlianlu-sms';
import {
  generateNumericCode,
  releaseSmsCodeSend,
  reserveSmsCodeSend,
  saveSmsCode,
  SmsCodeError,
} from '~/utils/sms-code-store';
import { resolveCurrentUserPhoneNumber } from '~/utils/user-service';

export default defineEventHandler(async (event) => {
  // 验证用户是否已登录
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event, '请先登录');
  }

  const phoneNumber = await resolveCurrentUserPhoneNumber({
    phone: userinfo.phone,
    username: userinfo.username,
  });
  if (!phoneNumber) {
    return badRequestResponse(
      '当前登录账号未绑定有效手机号，请联系管理员',
      event,
    );
  }

  try {
    reserveSmsCodeSend(phoneNumber);
  } catch (error) {
    if (error instanceof SmsCodeError) {
      const retryAfter = error.retryAfter ?? 0;
      if (retryAfter > 0) {
        event.node.res.setHeader('Retry-After', String(retryAfter));
      }
      return badRequestResponse(
        retryAfter > 0
          ? `${error.message}，请${retryAfter}秒后再试`
          : error.message,
        event,
        retryAfter > 0 ? 429 : 400,
      );
    }
    return serverErrorResponse('验证码发送频率验证失败', event);
  }

  const codeLength = Number(process.env.LOGIN_SMS_CODE_LENGTH ?? 6);
  const code = generateNumericCode(codeLength);

  try {
    await sendLoginVerificationCode({
      code,
      phoneNumber,
    });
    saveSmsCode(phoneNumber, code);

    const responsePayload: Record<string, unknown> = {
      expiresIn: Number(process.env.LOGIN_SMS_CODE_TTL ?? 300),
    };

    if (process.env.NODE_ENV !== 'production') {
      responsePayload.debugCode = code;
    }

    return useResponseSuccess(responsePayload, '验证码发送成功');
  } catch (error) {
    releaseSmsCodeSend(phoneNumber);
    console.error('发送联麓短信失败:', error);
    return serverErrorResponse('验证码发送失败，请稍后重试', event);
  }
});

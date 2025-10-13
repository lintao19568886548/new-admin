import {
  badRequestResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import { sendLoginVerificationCode } from '~/utils/shlianlu-sms';
import {
  ensureCanSendCode,
  generateNumericCode,
  saveSmsCode,
  SmsCodeError,
} from '~/utils/sms-code-store';
import { fetchUserWithDetails } from '~/utils/user-service';

interface SendCodeBody {
  phoneNumber?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as SendCodeBody;
  const phoneNumber = body?.phoneNumber?.trim();

  if (!phoneNumber) {
    return badRequestResponse('手机号不能为空', event);
  }

  if (!/^\d{11}$/.test(phoneNumber)) {
    return badRequestResponse('请输入11位手机号', event);
  }

  // 验证手机号是否在数据库中存在（作为用户名）
  try {
    const user = await fetchUserWithDetails(phoneNumber);
    if (!user) {
      return badRequestResponse('该手机号未注册', event);
    }
  } catch (error) {
    console.error('查询用户信息失败:', error);
    return serverErrorResponse('用户验证失败，请稍后重试', event);
  }

  try {
    ensureCanSendCode(phoneNumber);
  } catch (error) {
    if (error instanceof SmsCodeError) {
      const retryAfter = error.retryAfter ?? 0;
      return badRequestResponse(
        retryAfter > 0
          ? `${error.message}，请${retryAfter}秒后再试`
          : error.message,
        event,
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
    console.error('发送联麓短信失败:', error);
    return serverErrorResponse('验证码发送失败，请稍后重试', event);
  }
});

import dayjs from 'dayjs';
import { getMethod, getQuery, readBody } from 'h3';
import { getDeviceAbnormalConfirmationStatus } from '~/utils/attendance-abnormal-confirmation';
import {
  getAttendanceDeviceStatus,
  listAttendanceDeviceAbnormalLogs,
  replaceAttendanceDeviceBinding,
} from '~/utils/attendance-device';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';
import { sendLoginVerificationCode } from '~/utils/shlianlu-sms';
import {
  generateNumericCode,
  releaseSmsCodeSend,
  reserveSmsCodeSend,
  saveSmsCode,
  SmsCodeError,
  verifySmsCode,
} from '~/utils/sms-code-store';

type AttendanceDeviceAction = 'change' | 'send_change_code' | 'status';

async function resolveCurrentUserBoundPhone(userId: number) {
  const user = await prismaClient.user.findUnique({
    select: { phone: true, username: true },
    where: { id: userId },
  });
  const phone = String(user?.phone || '').trim();
  if (/^\d{11}$/.test(phone)) {
    return phone;
  }

  const username = String(user?.username || '').trim();
  return /^\d{11}$/.test(username) ? username : '';
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const method = getMethod(event).toUpperCase();

  try {
    if (method === 'GET') {
      const query = getQuery(event);
      const limit = Number(query.limit ?? 20);
      const targetDate = query.date ? dayjs(query.date as string) : dayjs();
      const items = await listAttendanceDeviceAbnormalLogs(userinfo.id, {
        endTime: targetDate.endOf('day').toDate(),
        limit,
        startTime: targetDate.startOf('day').toDate(),
      });

      return useResponseSuccess({
        items,
        total: items.length,
      });
    }

    if (method === 'POST') {
      const {
        action = 'status',
        device,
        punchTime,
        smsCode,
      } = (await readBody(event)) as {
        action?: AttendanceDeviceAction;
        device?: unknown;
        punchTime?: string;
        smsCode?: string;
      };
      const phoneNumber = await resolveCurrentUserBoundPhone(userinfo.id);

      if (action === 'change') {
        if (!phoneNumber) {
          return badRequestResponse('当前账号未绑定有效手机号', event);
        }
        const normalizedSmsCode = String(smsCode || '').trim();
        if (!normalizedSmsCode) {
          return badRequestResponse('请输入短信验证码', event);
        }
        try {
          await verifySmsCode(
            'attendanceDevice',
            phoneNumber,
            normalizedSmsCode,
          );
        } catch (error) {
          if (error instanceof SmsCodeError) {
            return badRequestResponse(error.message, event);
          }
          console.error('校验设备更换短信验证码失败:', error);
          return serverErrorResponse('验证码校验失败', event);
        }
        return useResponseSuccess(
          await replaceAttendanceDeviceBinding({
            deviceInput: device,
            user: userinfo,
          }),
        );
      }

      if (action === 'send_change_code') {
        if (!phoneNumber) {
          return badRequestResponse('当前账号未绑定有效手机号', event);
        }
        try {
          await reserveSmsCodeSend('attendanceDevice', phoneNumber);
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
        const responsePayload = {
          expiresIn: Number(process.env.LOGIN_SMS_CODE_TTL ?? 300),
          phoneNumber,
        };
        try {
          await sendLoginVerificationCode({
            code,
            phoneNumber,
          });
          await saveSmsCode('attendanceDevice', phoneNumber, code);
          return useResponseSuccess(responsePayload, '验证码发送成功');
        } catch (error) {
          await releaseSmsCodeSend('attendanceDevice', phoneNumber);
          console.error('发送设备更换短信验证码失败:', error);
          if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
            return serverErrorResponse(error.message, event);
          }
          return serverErrorResponse('验证码发送失败，请稍后重试', event);
        }
      }

      const actionMap: Record<
        Exclude<AttendanceDeviceAction, 'change' | 'send_change_code'>,
        () => Promise<unknown>
      > = {
        status: async () => {
          const decision = await getAttendanceDeviceStatus({
            deviceInput: device,
            user: userinfo,
          });
          if (decision.status !== 'abnormal') {
            return decision;
          }

          return {
            ...decision,
            ...(await getDeviceAbnormalConfirmationStatus({
              decision,
              punchTime,
              userId: userinfo.id,
            })),
          };
        },
      };
      const handler = actionMap[action];
      if (!handler) {
        return useResponseError('不支持的设备操作');
      }

      return useResponseSuccess(await handler());
    }

    return useResponseError('不支持的请求方法');
  } catch (error: any) {
    console.error('处理考勤设备接口失败:', error);
    return useResponseError(error.message || '处理考勤设备接口失败');
  }
});

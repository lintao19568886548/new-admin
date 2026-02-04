import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '~/utils/cookie-utils';
import { prismaClient } from '~/utils/db';
import { generateAccessToken, generateRefreshToken } from '~/utils/jwt-utils';
import { applyUserRolesToUser } from '~/utils/permission-modules';
import {
  badRequestResponse,
  forbiddenResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import { SmsCodeError, verifySmsCode } from '~/utils/sms-code-store';
import {
  fetchUserWithDetails,
  transformPrismaUserToUserInfo,
} from '~/utils/user-service';

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
      try {
        const plainPassword = randomBytes(24).toString('hex');
        const password = await bcrypt.hash(plainPassword, 10);

        const createdUser = await prismaClient.user.create({
          data: {
            username: phoneNumber,
            phone: phoneNumber,
            realName: phoneNumber,
            password,
          },
          select: {
            id: true,
          },
        });

        await applyUserRolesToUser({
          userId: createdUser.id,
          roleIds: [1],
        });
      } catch (error) {
        console.error('短信登录自动创建用户失败:', error);
      }

      const createdOrExistingUser = await fetchUserWithDetails(phoneNumber);
      if (!createdOrExistingUser) {
        clearRefreshTokenCookie(event);
        return forbiddenResponse(event, '该手机号未绑定系统账户');
      }

      const createdUserInfo = await transformPrismaUserToUserInfo(
        createdOrExistingUser,
      );

      const accessToken = generateAccessToken(createdUserInfo);
      const refreshToken = generateRefreshToken(createdUserInfo);

      setRefreshTokenCookie(event, refreshToken);

      return useResponseSuccess({
        ...createdUserInfo,
        accessToken,
      });
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

import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '~/utils/cookie-utils';
import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';
import {
  generateAccessToken,
  issueRefreshToken,
  persistRefreshToken,
} from '~/utils/jwt-utils';
import { setCachedUserInfoBestEffort } from '~/utils/permission-cache';
import { applyUserRolesToUser } from '~/utils/permission-modules';
import {
  badRequestResponse,
  forbiddenResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import { SmsCodeError, verifySmsCode } from '~/utils/sms-code-store';
import { resolveTenantUserForCenterUser } from '~/utils/user-customer-mapping';
import {
  getActiveCustomerForCenterUser,
  resolveUserInfoForTokenFromCenterUser,
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
    let userResult = await systemDbClient.user.findUnique({
      where: { username: phoneNumber },
      select: {
        id: true,
        username: true,
        customerType: true,
        tokenVersion: true,
        status: true,
      },
    });

    const rejectLogin = () => {
      clearRefreshTokenCookie(event);
      return forbiddenResponse(event, '手机号或验证码错误');
    };

    const issueTokensAndRespond = async (centerUser: {
      customerType: unknown;
      id: unknown;
      status?: unknown;
      tokenVersion?: unknown;
      username?: unknown;
    }) => {
      const customerContext = await getActiveCustomerForCenterUser(centerUser);
      if (!customerContext) {
        return rejectLogin();
      }

      const centerUserId = Number(centerUser.id);
      const customerId = customerContext.customerId;
      let userInfo = null;
      try {
        userInfo = await resolveUserInfoForTokenFromCenterUser({
          centerUserId,
          customerId,
          username: String(centerUser.username),
          tokenVersion: Number(centerUser.tokenVersion ?? 1),
          dbName: customerContext.dbName,
        });
      } catch (error) {
        console.error(
          `[code-login] customer db unavailable (customerId=${customerId}, userId=${centerUserId})`,
          error,
        );
      }
      if (!userInfo) {
        return rejectLogin();
      }

      await setCachedUserInfoBestEffort({
        customerId: userInfo.customerId,
        userId: userInfo.id,
        value: userInfo,
      });

      const accessToken = generateAccessToken(userInfo);
      const {
        expiresAt,
        jti,
        token: refreshToken,
      } = issueRefreshToken(userInfo);

      await persistRefreshToken({
        event,
        expiresAt,
        jti,
        refreshToken,
        userId: Number(userInfo.centerUserId),
      });

      setRefreshTokenCookie(event, refreshToken);

      return useResponseSuccess({
        ...userInfo,
        accessToken,
      });
    };

    const tryCreateUserIfMissing = async () => {
      try {
        const plainPassword = randomBytes(24).toString('hex');
        const password = await bcrypt.hash(plainPassword, 10);
        const defaultCustomerId = String(
          process.env.DEFAULT_CUSTOMER_ID || 'default',
        );
        const registerCustomerId = process.env.PUBLIC_DATABASE_URL
          ? 'public'
          : defaultCustomerId;

        const createdUser = await systemDbClient.user.create({
          data: {
            username: phoneNumber,
            phone: phoneNumber,
            realName: phoneNumber,
            password,
            customerType: registerCustomerId,
          },
          select: {
            id: true,
            tokenVersion: true,
          },
        });

        const centerCustomer = await systemDbClient.customer.findUnique({
          where: { customerId: registerCustomerId },
          select: { dbName: true },
        });

        await prismaScopeStorage.run(
          { customerId: registerCustomerId },
          async () => {
            const customerUser = await prismaClient.user.upsert({
              where: { username: phoneNumber },
              create: {
                username: phoneNumber,
                phone: phoneNumber,
                realName: phoneNumber,
                password,
                customerType: registerCustomerId,
                tokenVersion: 1,
                status: 1,
              },
              update: {
                phone: phoneNumber,
                realName: phoneNumber,
                password,
                customerType: registerCustomerId,
                status: 1,
              },
              select: { id: true },
            });

            await applyUserRolesToUser({
              userId: Number(customerUser.id),
              roleIds: [1],
            });

            await resolveTenantUserForCenterUser({
              centerUserId: Number(createdUser.id),
              customerId: registerCustomerId,
              username: phoneNumber,
              dbName: centerCustomer?.dbName
                ? String(centerCustomer.dbName)
                : null,
              prisma: prismaClient,
            });
          },
        );
      } catch (error) {
        console.error('短信登录自动创建用户失败:', error);
      }
    };

    if (!userResult) {
      await tryCreateUserIfMissing();
      userResult = await systemDbClient.user.findUnique({
        where: { username: phoneNumber },
        select: {
          id: true,
          username: true,
          customerType: true,
          tokenVersion: true,
          status: true,
        },
      });
    }

    if (!userResult) {
      return rejectLogin();
    }

    return await issueTokensAndRespond(userResult);
  } catch (error) {
    console.error('短信验证码登录失败:', error);
    clearRefreshTokenCookie(event);
    return serverErrorResponse('短信验证码登录失败，请稍后重试', event);
  }
});

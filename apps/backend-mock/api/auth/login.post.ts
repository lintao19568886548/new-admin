import bcrypt from 'bcryptjs';
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '~/utils/cookie-utils';
import { systemDbClient } from '~/utils/db';
import {
  generateAccessToken,
  issueRefreshToken,
  persistRefreshToken,
} from '~/utils/jwt-utils';
import { setCachedUserInfoBestEffort } from '~/utils/permission-cache';
import { forbiddenResponse } from '~/utils/response';
import {
  getActiveCustomerForCenterUser,
  resolveUserInfoForTokenFromCenterUser,
} from '~/utils/user-service';

export default defineEventHandler(async (event) => {
  const { password, username } = await readBody(event);
  if (!password || !username) {
    setResponseStatus(event, 400);
    return useResponseError(
      'BadRequestException',
      'Username and password are required',
    );
  }

  const normalizedUsername = String(username).trim();

  // 1. 获取用户详细信息
  const userResult = await (async () => {
    const userByUsername = await systemDbClient.user.findUnique({
      where: { username: normalizedUsername },
      select: {
        id: true,
        username: true,
        password: true,
        customerType: true,
        tokenVersion: true,
        status: true,
      },
    });
    if (userByUsername) {
      return userByUsername;
    }
    if (!/^\d{11}$/.test(normalizedUsername)) {
      return null;
    }
    return systemDbClient.user.findFirst({
      where: { phone: normalizedUsername },
      select: {
        id: true,
        username: true,
        password: true,
        customerType: true,
        tokenVersion: true,
        status: true,
      },
    });
  })();

  if (!userResult) {
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, '用户名或密码错误');
  }
  const activeCustomer = await getActiveCustomerForCenterUser(userResult);
  if (!activeCustomer) {
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, '用户名或密码错误');
  }
  const { customerId, dbName } = activeCustomer;

  // 2. 验证密码
  let isPasswordValid = false;
  try {
    isPasswordValid = await bcrypt.compare(password, userResult.password);
  } catch (error) {
    console.warn(
      `Bcrypt compare failed for user ${username}, possibly plaintext password. Error: ${error}`,
    );
  }

  if (!isPasswordValid && password === userResult.password) {
    isPasswordValid = true;
    try {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      // 原文密码时更新用户密码
      await systemDbClient.user.update({
        where: { id: userResult.id },
        data: { password: hashedPassword },
      });
      console.log(
        `User ${username}'s password has been updated to hashed version.`,
      );
    } catch (hashError) {
      console.error(
        `Failed to hash and update password for user ${username}:`,
        hashError,
      );
    }
  }

  if (!isPasswordValid) {
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, '用户名或密码错误');
  }

  let userInfoForToken = null;
  try {
    userInfoForToken = await resolveUserInfoForTokenFromCenterUser({
      centerUserId: Number(userResult.id),
      customerId,
      username: String(userResult.username),
      tokenVersion: Number(userResult.tokenVersion ?? 1),
      dbName,
    });
  } catch (error) {
    console.error(
      `[login] customer db unavailable (customerId=${customerId}, userId=${userResult.id})`,
      error,
    );
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, '用户名或密码错误');
  }

  if (!userInfoForToken) {
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, '用户名或密码错误');
  }

  await setCachedUserInfoBestEffort({
    customerId: userInfoForToken.customerId,
    userId: userInfoForToken.id,
    value: userInfoForToken,
  });

  // 4. 生成令牌
  const accessToken = generateAccessToken(userInfoForToken);
  const {
    expiresAt,
    jti,
    token: refreshToken,
  } = issueRefreshToken(userInfoForToken);

  await persistRefreshToken({
    event,
    expiresAt,
    jti,
    refreshToken,
    userId: Number(userInfoForToken.centerUserId),
  });

  setRefreshTokenCookie(event, refreshToken);

  return useResponseSuccess({
    ...userInfoForToken, // 返回转换后的用户信息
    accessToken,
  });
});

import bcrypt from 'bcryptjs';
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '~/utils/cookie-utils';
import { prismaClient } from '~/utils/db';
import { generateAccessToken, generateRefreshToken } from '~/utils/jwt-utils';
import { forbiddenResponse } from '~/utils/response';
import {
  fetchUserWithDetails,
  transformPrismaUserToUserInfo, // 如果需要直接使用此类型
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

  // 1. 获取用户详细信息
  const userResult = await fetchUserWithDetails(username);

  if (!userResult) {
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, '用户名或密码错误');
  }

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
      await prismaClient.user.update({
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

  // 3. 使用新服务转换用户信息
  const userInfoForToken = await transformPrismaUserToUserInfo(userResult);

  // 4. 生成令牌
  const accessToken = generateAccessToken(userInfoForToken);
  const refreshToken = generateRefreshToken(userInfoForToken);

  setRefreshTokenCookie(event, refreshToken);

  return useResponseSuccess({
    ...userInfoForToken, // 返回转换后的用户信息
    accessToken,
  });
});

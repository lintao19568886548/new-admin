import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '~/utils/cookie-utils';
import { prismaClient } from '~/utils/db';
import { generateAccessToken, generateRefreshToken } from '~/utils/jwt-utils';
import { forbiddenResponse } from '~/utils/response';

export default defineEventHandler(async (event) => {
  const { password, username } = await readBody(event);
  if (!password || !username) {
    setResponseStatus(event, 400);
    return useResponseError(
      'BadRequestException',
      'Username and password are required',
    );
  }

  const userResult = await prismaClient.user.findUnique({
    where: {
      username,
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!userResult) {
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, 'Username or password is incorrect.');
  }
  // 将数据库结果转换为 UserInfo 类型
  const findUser: UserInfo = {
    id: Number(userResult.id),
    username: String(userResult.username),
    password: String(userResult.password),
    realName: String(userResult.realName),
    roles: Array.isArray(userResult.roles)
      ? userResult.roles.map((item) => item.role.name)
      : [],
    homePath: userResult.homePath ? String(userResult.homePath) : undefined,
    parks: [],
  };

  const accessToken = generateAccessToken(findUser);
  const refreshToken = generateRefreshToken(findUser);

  setRefreshTokenCookie(event, refreshToken);

  return useResponseSuccess({
    ...findUser,
    accessToken,
  });
});

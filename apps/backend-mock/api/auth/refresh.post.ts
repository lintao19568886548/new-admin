import type { UserInfoForToken } from '~/utils/user-service';

import {
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  setRefreshTokenCookie,
} from '~/utils/cookie-utils';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '~/utils/jwt-utils';
import { forbiddenResponse } from '~/utils/response';
// 从新的 user-service 导入
import {
  fetchUserWithDetails,
  transformPrismaUserToUserInfo,
} from '~/utils/user-service';

export default defineEventHandler(async (event) => {
  const oldRefreshToken = getRefreshTokenFromCookie(event);

  if (!oldRefreshToken) {
    return forbiddenResponse(event);
  }

  let verifiedPayload: null | UserInfoForToken; // 使用 UserInfoForToken 类型
  try {
    verifiedPayload = await verifyRefreshToken(oldRefreshToken);
  } catch (error) {
    console.error('Refresh token verification failed:', error);
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, 'Invalid refresh token');
  }

  if (!verifiedPayload || !verifiedPayload.username) {
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, 'Invalid refresh token payload');
  }

  // 1. 使用新服务获取最新的用户信息
  const currentUserFromDB = await fetchUserWithDetails(
    verifiedPayload.username,
  );

  if (!currentUserFromDB) {
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, 'User not found');
  }

  // 2. 使用新服务转换用户信息
  const userInfoForToken =
    await transformPrismaUserToUserInfo(currentUserFromDB);

  // 3. 生成新的 accessToken 和 refreshToken
  const newAccessToken = generateAccessToken(userInfoForToken);
  const newRefreshToken = generateRefreshToken(userInfoForToken);

  setRefreshTokenCookie(event, newRefreshToken);

  return useResponseSuccess({ accessToken: newAccessToken });
});

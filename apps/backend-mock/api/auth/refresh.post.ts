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

/**
 * @description 刷新 Access Token 的后端接口
 *
 * 1.  验证请求中的 `refreshToken`。
 * 2.  从数据库中获取最新的用户信息，以防用户信息变更或用户被禁用。
 * 3.  签发一个新的 `accessToken`。
 * 4.  执行 `refreshToken` 轮换（Rotation），签发一个新的 `refreshToken` 以提高安全性。
 * 5.  将新的 `refreshToken` 通过 `HttpOnly` 的 `cookie` 返回。
 */
export default defineEventHandler(async (event) => {
  const oldRefreshToken = getRefreshTokenFromCookie(event);

  // 如果 cookie 中不存在 refreshToken，直接返回错误
  if (!oldRefreshToken) {
    return forbiddenResponse(event, 'Refresh token not provided.');
  }

  try {
    // 步骤 1: 验证旧的 refreshToken
    const verifiedPayload = (await verifyRefreshToken(
      oldRefreshToken,
    )) as null | UserInfoForToken;
    if (!verifiedPayload?.username) {
      // 抛出错误，由 catch 块统一处理
      throw new Error('Invalid refresh token payload');
    }

    // 步骤 2: 获取最新的用户信息以确保用户状态有效
    const currentUserFromDB = await fetchUserWithDetails(
      verifiedPayload.username,
    );
    if (!currentUserFromDB) {
      throw new Error('User not found');
    }

    // 步骤 3: 转换用户信息，为生成新 token 做准备
    const userInfoForToken =
      await transformPrismaUserToUserInfo(currentUserFromDB);

    // 步骤 4: 生成新的 accessToken 和 refreshToken (RefreshToken Rotation)
    const newAccessToken = generateAccessToken(userInfoForToken);
    const newRefreshToken = generateRefreshToken(userInfoForToken);

    // 步骤 5: 在 HttpOnly cookie 中设置新的 refreshToken
    setRefreshTokenCookie(event, newRefreshToken);

    // 步骤 6: 返回新的 accessToken
    return newAccessToken;
  } catch (error: any) {
    // 统一的错误处理中心
    console.error('An error occurred during token refresh:', error.message);

    // 不论发生何种错误，都清除客户端的 refreshToken cookie
    clearRefreshTokenCookie(event);

    // 向客户端返回一个统一的、对用户友好的错误响应
    return forbiddenResponse(event, '会话过期，请重新登录.');
  }
});

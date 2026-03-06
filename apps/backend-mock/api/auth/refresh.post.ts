import type { UserInfoForToken } from '~/utils/user-service';

import {
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  setRefreshTokenCookie,
} from '~/utils/cookie-utils';
import { systemDbClient } from '~/utils/db';
import {
  generateAccessToken,
  hashToken,
  issueRefreshToken,
  persistRefreshToken,
  verifyRefreshToken,
} from '~/utils/jwt-utils';
import { setCachedUserInfoBestEffort } from '~/utils/permission-cache';
import { unAuthorizedResponse } from '~/utils/response';
import {
  getActiveCustomerForCenterUser,
  resolveUserInfoForTokenFromCenterUser,
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
    clearRefreshTokenCookie(event);
    return unAuthorizedResponse(event, '会话过期，请重新登录');
  }

  try {
    // 步骤 1: 验证旧的 refreshToken
    const verifiedPayload = (await verifyRefreshToken(
      oldRefreshToken,
    )) as null | UserInfoForToken;
    if (!verifiedPayload?.username || !verifiedPayload?.jti) {
      // 抛出错误，由 catch 块统一处理
      throw new Error('Invalid refresh token payload');
    }

    const tokenHash = hashToken(oldRefreshToken);
    const stored = await systemDbClient.refreshToken.findUnique({
      where: { jti: String(verifiedPayload.jti) },
      select: {
        expiresAt: true,
        revokedAt: true,
        tokenHash: true,
        userId: true,
      },
    });

    if (!stored || stored.tokenHash !== tokenHash) {
      throw new Error('Refresh token not found');
    }

    if (stored.revokedAt) {
      await systemDbClient.$transaction(async (tx) => {
        await tx.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.user.update({
          where: { id: stored.userId },
          data: { tokenVersion: { increment: 1 } },
        });
      });
      throw new Error('Refresh token reused');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new Error('Refresh token expired');
    }

    // 步骤 2: 获取最新的用户信息以确保用户状态有效
    const currentUserFromDB = await systemDbClient.user.findUnique({
      where: { id: stored.userId },
      select: {
        id: true,
        username: true,
        customerType: true,
        status: true,
        tokenVersion: true,
      },
    });
    if (!currentUserFromDB) {
      throw new Error('User not found');
    }
    if (!currentUserFromDB.customerType) {
      throw new Error('Customer not found');
    }

    if (
      currentUserFromDB.status === 0 ||
      Number(currentUserFromDB.tokenVersion ?? 1) !==
        Number(verifiedPayload.tokenVersion ?? 1)
    ) {
      await systemDbClient.refreshToken.update({
        where: { jti: String(verifiedPayload.jti) },
        data: { revokedAt: new Date() },
      });
      throw new Error('Token version mismatch');
    }

    const customerContext =
      await getActiveCustomerForCenterUser(currentUserFromDB);
    if (!customerContext) {
      throw new Error('Customer disabled');
    }

    const customerId = customerContext.customerId;
    let userInfoForToken: null | UserInfoForToken = null;
    try {
      userInfoForToken = await resolveUserInfoForTokenFromCenterUser({
        centerUserId: Number(currentUserFromDB.id),
        customerId,
        username: String(currentUserFromDB.username),
        tokenVersion: Number(currentUserFromDB.tokenVersion ?? 1),
        dbName: customerContext.dbName,
      });
    } catch (error) {
      console.error(
        `[refresh] customer db unavailable (customerId=${customerId}, userId=${currentUserFromDB.id})`,
        error,
      );
      throw new Error('Customer database unavailable');
    }
    if (!userInfoForToken) {
      throw new Error('Customer user mapping missing');
    }

    await setCachedUserInfoBestEffort({
      customerId: userInfoForToken.customerId,
      userId: userInfoForToken.id,
      value: userInfoForToken,
    });

    // 步骤 4: 生成新的 accessToken 和 refreshToken (RefreshToken Rotation)
    const newAccessToken = generateAccessToken(userInfoForToken);
    const {
      expiresAt,
      jti,
      token: newRefreshToken,
    } = issueRefreshToken(userInfoForToken);

    await systemDbClient.$transaction(async (tx) => {
      await persistRefreshToken({
        db: tx,
        event,
        expiresAt,
        jti,
        refreshToken: newRefreshToken,
        userId: Number(userInfoForToken.centerUserId),
      });

      await tx.refreshToken.update({
        where: { jti: String(verifiedPayload.jti) },
        data: { replacedByJti: jti, revokedAt: new Date() },
      });
    });

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
    return unAuthorizedResponse(event, '会话过期，请重新登录');
  }
});

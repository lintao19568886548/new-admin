import {
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
} from '~/utils/cookie-utils';
import { systemDbClient } from '~/utils/db';
import { hashToken, verifyRefreshToken } from '~/utils/jwt-utils';

export default defineEventHandler(async (event) => {
  const refreshToken = getRefreshTokenFromCookie(event);
  if (!refreshToken) {
    return useResponseSuccess('');
  }

  const payload = verifyRefreshToken(refreshToken);
  if (payload?.id && payload?.jti) {
    const existing = await systemDbClient.refreshToken
      .findUnique({
        where: { jti: String(payload.jti) },
        select: { tokenHash: true, userId: true },
      })
      .catch(() => null);
    if (existing && existing.tokenHash === hashToken(refreshToken)) {
      await systemDbClient.refreshToken
        .update({
          where: { jti: String(payload.jti) },
          data: { revokedAt: new Date() },
        })
        .catch(() => undefined);
      await systemDbClient.user
        .update({
          where: { id: existing.userId },
          data: { tokenVersion: { increment: 1 } },
        })
        .catch(() => undefined);
    }
  }

  clearRefreshTokenCookie(event);

  return useResponseSuccess('');
});

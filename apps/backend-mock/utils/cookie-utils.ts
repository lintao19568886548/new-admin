import type { EventHandlerRequest, H3Event } from 'h3';

export function clearRefreshTokenCookie(event: H3Event<EventHandlerRequest>) {
  deleteCookie(event, 'jwt', {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
  });
}

export function setRefreshTokenCookie(
  event: H3Event<EventHandlerRequest>,
  refreshToken: string,
) {
  setCookie(event, 'jwt', refreshToken, {
    httpOnly: true,
    // 与 REFRESH_TOKEN_EXPIRES_IN 保持一致（30 天）
    maxAge: 30 * 24 * 60 * 60, // unit: seconds
    sameSite: 'none',
    secure: true,
  });
}

export function getRefreshTokenFromCookie(event: H3Event<EventHandlerRequest>) {
  const refreshToken = getCookie(event, 'jwt');
  return refreshToken;
}

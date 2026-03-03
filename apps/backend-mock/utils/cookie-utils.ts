import type { EventHandlerRequest, H3Event } from 'h3';

function isSecureCookie() {
  if (process.env.REFRESH_TOKEN_COOKIE_SECURE === 'true') return true;
  if (process.env.REFRESH_TOKEN_COOKIE_SECURE === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export function clearRefreshTokenCookie(event: H3Event<EventHandlerRequest>) {
  const secure = isSecureCookie();
  deleteCookie(event, 'jwt', {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
  });
}

export function setRefreshTokenCookie(
  event: H3Event<EventHandlerRequest>,
  refreshToken: string,
) {
  const secure = isSecureCookie();
  setCookie(event, 'jwt', refreshToken, {
    httpOnly: true,
    maxAge: Number(
      process.env.REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS || 7 * 24 * 60 * 60,
    ),
    sameSite: secure ? 'none' : 'lax',
    secure,
  });
}

export function getRefreshTokenFromCookie(event: H3Event<EventHandlerRequest>) {
  const refreshToken = getCookie(event, 'jwt');
  return refreshToken;
}

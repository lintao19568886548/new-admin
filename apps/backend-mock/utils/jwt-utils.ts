import type { H3Event } from 'h3';

import type { UserInfoForToken } from './user-service'; // 导入 UserInfoForToken

import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access-secret';
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';

const ACCESS_TOKEN_EXPIRES_IN =
  process.env.NODE_ENV === 'development' ? '1d' : '1d'; // 例如 1 天
const REFRESH_TOKEN_EXPIRES_IN = '30d'; // 例如 7 天

/**
 * 生成 Access Token
 * @param userinfo 用户信息
 * @returns Access Token
 */
export function generateAccessToken(userinfo: UserInfoForToken): string {
  // 确保 userinfo 中不包含敏感信息，如密码
  const payload = { ...userinfo };
  // delete payload.password; // 如果 UserInfoForToken 可能意外包含 password，则删除
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

/**
 * 生成 Refresh Token
 * @param userinfo 用户信息
 * @returns Refresh Token
 */
export function generateRefreshToken(userinfo: UserInfoForToken): string {
  // 确保 userinfo 中不包含敏感信息
  const payload = { ...userinfo };
  // delete payload.password;

  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

/**
 * 验证 Access Token
 * @param event H3Event
 * @returns 用户信息或 null
 */
export async function verifyAccessToken(
  event: H3Event,
): Promise<null | UserInfoForToken> {
  const token = getHeader(event, 'Authorization')?.split(' ')[1];
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    // 检查 decoded 是否为对象类型，并且包含 iat 和 exp
    if (typeof decoded === 'object' && decoded !== null) {
      const { iat: _iat, exp: _exp, ...userPayload } = decoded as any; // 使用 any 辅助解构
      return userPayload as UserInfoForToken;
    }
    // 如果 decoded 不是预期的对象结构，或者不包含 iat/exp (理论上 jwt.verify 会确保它们存在或抛错)
    // 但为了类型安全和明确性，可以返回 null 或原始 decoded (如果认为外部调用者能处理)
    // 在此场景下，我们期望 userPayload 符合 UserInfoForToken
    return decoded as UserInfoForToken; // 或者根据严格程度返回 null
  } catch (error) {
    console.error('Access token verification failed:', error);
    return null;
  }
}

/**
 * 验证 Refresh Token
 * @param token Refresh Token 字符串
 * @returns 用户信息或 null
 */
export async function verifyRefreshToken(
  token: string,
): Promise<null | UserInfoForToken> {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
    // 检查 decoded 是否为对象类型，并且包含 iat 和 exp
    if (typeof decoded === 'object' && decoded !== null) {
      const { iat: _iat, exp: _exp, ...userPayload } = decoded as any; // 使用 any 辅助解构
      return userPayload as UserInfoForToken;
    }
    // 同上，处理非预期结构的情况
    return decoded as UserInfoForToken; // 或者根据严格程度返回 null
  } catch (error) {
    console.error('Refresh token verification failed:', error);
    return null;
  }
}

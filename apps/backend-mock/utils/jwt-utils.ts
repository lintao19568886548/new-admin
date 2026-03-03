import type { EventHandlerRequest, H3Event } from 'h3';
import type { StringValue } from 'ms';

import type { UserInfoForToken } from './user-service'; // 导入 UserInfoForToken

import { createHash, randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { prismaScopeStorage, systemDbClient } from './db';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access-secret';
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';

const ACCESS_TOKEN_EXPIRES_IN: number | StringValue =
  (process.env.ACCESS_TOKEN_EXPIRES_IN as StringValue | undefined) || '30m';
const REFRESH_TOKEN_EXPIRES_IN: number | StringValue =
  (process.env.REFRESH_TOKEN_EXPIRES_IN as StringValue | undefined) || '7d';

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

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * 生成 Refresh Token
 * @param userinfo 用户信息
 * @returns Refresh Token
 */
export function issueRefreshToken(userinfo: UserInfoForToken): {
  expiresAt: Date;
  jti: string;
  token: string;
} {
  // 确保 userinfo 中不包含敏感信息
  const jti = randomUUID();
  const payload = { ...userinfo, jti };
  // delete payload.password;

  const token = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
  const decoded = jwt.decode(token) as any;
  const expSeconds = Number(decoded?.exp);
  const expiresAt = Number.isFinite(expSeconds)
    ? new Date(expSeconds * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return { expiresAt, jti, token };
}

/**
 * 验证 Access Token
 * @param event H3Event
 * @returns 用户信息或 null
 */
export function verifyAccessToken(event: H3Event): null | UserInfoForToken {
  const token = getHeader(event, 'Authorization')?.split(' ')[1];
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    // 检查 decoded 是否为对象类型，并且包含 iat 和 exp
    if (typeof decoded === 'object' && decoded !== null) {
      const { iat: _iat, exp: _exp, ...userPayload } = decoded as any; // 使用 any 辅助解构
      const scopedCustomerId = (userPayload as any)?.customerId;
      if (scopedCustomerId && !prismaScopeStorage.getStore()?.customerId) {
        prismaScopeStorage.enterWith({ customerId: String(scopedCustomerId) });
      }
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
 * 仅解码 Access Token 以获取用户信息，不进行签名验证
 * @param event H3Event
 * @returns 用户信息或 null
 */
export function decodeAccessToken(event: H3Event): null | UserInfoForToken {
  const token = getHeader(event, 'Authorization')?.split(' ')[1];
  if (!token) {
    return null;
  }
  try {
    // 只解码，不验证
    const decoded = jwt.decode(token);
    // 检查 decoded 是否为对象类型
    if (typeof decoded === 'object' && decoded !== null) {
      // 假设 payload 结构符合 UserInfoForToken (可能需要调整类型断言)
      // 注意：这里没有 iat 和 exp 的显式检查，因为 decode 不保证它们存在
      // 如果需要，可以在这里添加对特定字段的检查
      const { iat: _iat, exp: _exp, ...userPayload } = decoded as any; // 使用 any 辅助解构
      return userPayload as UserInfoForToken;
    }
    return null; // 如果解码结果不是对象，则返回 null
  } catch (error) {
    // decode 一般不会因为格式错误之外的原因抛错，但以防万一
    console.error('Access token decoding failed:', error);
    return null;
  }
}

/**
 * 验证 Refresh Token
 * @param token Refresh Token 字符串
 * @returns 用户信息或 null
 */
export function verifyRefreshToken(token: string): null | UserInfoForToken {
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

export async function persistRefreshToken(params: {
  db?: { refreshToken: { create: (args: any) => Promise<any> } };
  event: H3Event<EventHandlerRequest>;
  expiresAt: Date;
  jti: string;
  refreshToken: string;
  userId: number;
}) {
  const db = params.db ?? systemDbClient;
  await db.refreshToken.create({
    data: {
      expiresAt: params.expiresAt,
      jti: params.jti,
      tokenHash: hashToken(params.refreshToken),
      userId: Number(params.userId),
    },
  });
}

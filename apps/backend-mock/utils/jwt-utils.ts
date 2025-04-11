import type { EventHandlerRequest, H3Event } from 'h3';

import jwt from 'jsonwebtoken';

import { UserInfo } from './mock-data';

// TODO: Replace with your own secret key
const ACCESS_TOKEN_SECRET = 'access_token_secret';
const REFRESH_TOKEN_SECRET = 'refresh_token_secret';

export interface UserPayload extends UserInfo {
  iat: number;
  exp: number;
}

export function generateAccessToken(user: UserInfo) {
  return jwt.sign(user, ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
}

export function generateRefreshToken(user: UserInfo) {
  return jwt.sign(user, REFRESH_TOKEN_SECRET, {
    expiresIn: '30d',
  });
}

async function getUserInfo(username: string) {
  return await prismaClient.user.findUnique({
    where: {
      username,
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
      parks: {
        include: {
          park: true,
        },
      },
    },
  });
}

export async function verifyAccessToken(
  event: H3Event<EventHandlerRequest>,
): Promise<null | Promise<Omit<UserInfo, 'password'>>> {
  const authHeader = getHeader(event, 'Authorization');
  if (!authHeader?.startsWith('Bearer')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as UserPayload;

    const username = decoded.username;
    // 使用数据库查询替代硬编码的用户查找
    const user = await getUserInfo(username);
    if (!user) return null;
    const userInfo: Omit<UserInfo, 'password'> = {
      id: Number(user.id),
      username: String(user.username),
      realName: String(user.realName),
      roles: Array.isArray(user.roles)
        ? user.roles.map((item) => item.role.name)
        : [],
      parks: Array.isArray(user.parks)
        ? user.parks.map((item) => item.park.parkName)
        : [],
      homePath: user.homePath ? String(user.homePath) : undefined,
    };
    return userInfo;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
): Promise<null | Promise<Omit<UserInfo, 'password'>>> {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as UserPayload;
    const username = decoded.username;

    // 使用数据库查询替代硬编码的用户查找
    const user = await getUserInfo(username);
    // 转换为 UserInfo 类型并排除密码
    const userInfo: Omit<UserInfo, 'password'> = {
      id: Number(user.id),
      username: String(user.username),
      realName: String(user.realName),
      roles: Array.isArray(user.roles)
        ? user.roles.map((item) => item.role.name)
        : [],
      parks: Array.isArray(user.parks)
        ? user.parks.map((item) => item.park.parkName)
        : [],
      homePath: user.homePath ? String(user.homePath) : undefined,
    };

    return userInfo;
  } catch {
    return null;
  }
}

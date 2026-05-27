import type {
  Park,
  PrismaClient,
  Role,
  User,
  UserRole,
} from '@prisma/.prisma/client/index.js';

import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';
import { resolveTenantUserForCenterUser } from '~/utils/user-customer-mapping';

export async function isInternalAccountPhone(
  phoneNumber: string,
  prisma: PrismaClient = prismaClient,
): Promise<boolean> {
  const normalized = phoneNumber.trim();
  if (!/^\d{11}$/.test(normalized)) {
    return false;
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ phone: normalized }, { username: normalized }],
    },
    select: { id: true },
  });

  return Boolean(user);
}

// 定义令牌中用户信息的标准结构
export interface UserInfoForToken {
  customerId: string;
  tokenVersion: number;
  id: number;
  centerUserId?: number;
  phone?: string;
  username: string;
  realName: string;
  roles: string[];
  homePath?: string;
  parks: Array<{ parkId: number; parkName: string }>;
  reimbursementAuth?: number;
  rates?: number;
  codes: string[];
  jti?: string;
}

// Prisma返回的带有完整关联信息的用户类型 (近似表示)
// 您可能需要根据实际的Prisma查询结果调整此类型，或使用Prisma生成的类型
type PrismaRoleWithParks = Role & {
  roleCodes: Array<{
    code: null | { code: string; templateDeletedAt?: Date | null };
  }>;
  roleParks: (UserRole & {
    role: Role & {
      roleParks: { park: Park }[];
    };
  })['role']['roleParks'];
};

type UserWithFullDetails = User & {
  roles: (UserRole & {
    role: null | PrismaRoleWithParks;
  })[];
};

function normalizePhoneCandidate(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

export function resolveUserPhoneNumber(user: {
  phone?: unknown;
  username?: unknown;
}): string {
  const username = normalizePhoneCandidate(user.username);
  if (/^\d{11}$/.test(username)) {
    return username;
  }

  const phone = normalizePhoneCandidate(user.phone);
  if (/^\d{11}$/.test(phone)) {
    return phone;
  }

  return '';
}

/**
 * 从数据库获取用户及其完整的角色和园区信息
 * @param username 用户名
 * @returns 用户对象或 null
 */
export async function fetchUserWithDetails(
  username: string,
  prisma: PrismaClient = prismaClient,
): Promise<null | UserWithFullDetails> {
  return prisma.user.findUnique({
    where: { username },
    include: {
      roles: {
        include: {
          role: {
            include: {
              roleParks: {
                where: { isDeleted: false },
                include: {
                  park: true,
                },
              },
              roleCodes: {
                include: {
                  code: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

/**
 * 将 Prisma 用户对象转换为用于令牌的 userInfo 结构
 * @param prismaUser 从数据库获取的原始用户对象
 * @returns UserInfoForToken 对象
 */
export async function transformPrismaUserToUserInfo(
  prismaUser: UserWithFullDetails,
  prisma: PrismaClient = prismaClient,
): Promise<UserInfoForToken> {
  const userRoles = Array.isArray(prismaUser.roles) ? prismaUser.roles : [];
  const validUserRoles = userRoles.filter(
    (item): item is UserRole & { role: PrismaRoleWithParks } =>
      Boolean(item.role),
  );

  const roles = validUserRoles
    .map((item) => item.role.name)
    .filter(
      (name): name is string => typeof name === 'string' && name.length > 0,
    );

  let reimbursementAuth = 0;
  let rates = 0;

  // 遍历用户所有角色，找到最高的审核权限和对应的金额
  for (const userRole of validUserRoles) {
    const role = userRole.role;
    if (role.reimbursementAuth && role.reimbursementAuth > reimbursementAuth) {
      reimbursementAuth = role.reimbursementAuth;
      rates = role.rates || 0;
    }
  }

  let parks: Array<{ parkId: number; parkName: string }> = [];

  if (roles.includes('Super')) {
    const superAdminParks = await prisma.park.findMany({
      select: { parkId: true, parkName: true },
      where: { isDeleted: false }, // 确保只选择未删除的园区
    });
    parks = superAdminParks.map((p) => ({
      parkId: Number(p.parkId), // 确保 parkId 是字符串
      parkName: String(p.parkName),
    }));
  } else {
    const userParks = validUserRoles.flatMap((userRole) =>
      userRole.role.roleParks.map((rp) => ({
        parkId: Number(rp.park.parkId), // 确保 parkId 是字符串
        parkName: String(rp.park.parkName),
      })),
    );
    // 去重，因为一个用户可能通过不同角色关联到同一个园区
    const uniqueParksMap = new Map<
      number,
      { parkId: number; parkName: string }
    >();
    userParks.forEach((park) => uniqueParksMap.set(park.parkId, park));
    parks = [...uniqueParksMap.values()];
  }

  // 获取用户的所有权限码
  const userCodes = validUserRoles.flatMap((userRole) =>
    userRole.role.roleCodes
      .filter((rc) => !rc.code?.templateDeletedAt)
      .map((rc) => rc.code?.code)
      .filter(
        (code): code is string => typeof code === 'string' && code.length > 0,
      ),
  );
  // 去重权限码
  const codes = [...new Set(userCodes)];

  const defaultCustomerId = String(
    process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  let customerId = defaultCustomerId;
  if (prismaUser.customerType) {
    customerId = String(prismaUser.customerType);
  }

  return {
    customerId,
    tokenVersion: Number(prismaUser.tokenVersion ?? 1),
    id: Number(prismaUser.id),
    phone: resolveUserPhoneNumber(prismaUser) || undefined,
    username: String(prismaUser.username),
    realName: String(prismaUser.realName),
    roles,
    homePath: prismaUser.homePath ? String(prismaUser.homePath) : undefined,
    parks,
    reimbursementAuth,
    rates,
    codes,
  };
}

export async function resolveCurrentUserPhoneNumber(params: {
  phone?: string;
  prisma?: PrismaClient;
  username: string;
}): Promise<string> {
  const fromPayload = resolveUserPhoneNumber(params);
  if (fromPayload) {
    return fromPayload;
  }

  const currentUser = await fetchUserWithDetails(
    params.username,
    params.prisma ?? prismaClient,
  );

  return currentUser ? resolveUserPhoneNumber(currentUser) : '';
}

export async function getActiveCustomerForCenterUser(centerUser: {
  customerType?: unknown;
  status?: unknown;
}): Promise<null | { customerId: string; dbName: null | string }> {
  if (Number(centerUser.status ?? 1) !== 1) {
    return null;
  }
  if (!centerUser.customerType) {
    return null;
  }
  const customerId = String(centerUser.customerType);
  const customer = await systemDbClient.customer.findUnique({
    where: { customerId },
    select: { status: true, dbName: true },
  });
  if (!customer || customer.status === 0) {
    return null;
  }
  return {
    customerId,
    dbName: customer.dbName ? String(customer.dbName) : null,
  };
}

export async function resolveUserInfoForTokenFromCenterUser(params: {
  centerUserId: number;
  customerId: string;
  dbName: null | string;
  prisma?: PrismaClient;
  tokenVersion: number;
  username: string;
}): Promise<null | UserInfoForToken> {
  const customerId = String(params.customerId);
  const prisma = params.prisma ?? prismaClient;
  const base = await prismaScopeStorage.run(
    {
      customerId,
      dbName: params.dbName ? String(params.dbName) : null,
    },
    async () => {
      const resolved = await resolveTenantUserForCenterUser({
        centerUserId: Number(params.centerUserId),
        customerId,
        username: String(params.username),
        dbName: params.dbName ? String(params.dbName) : null,
        prisma,
      });
      if (!resolved) {
        return null;
      }

      const customerUser = await fetchUserWithDetails(
        resolved.username,
        prisma,
      );
      if (!customerUser) {
        return null;
      }
      if (Number(customerUser.status ?? 1) !== 1) {
        return null;
      }
      return await transformPrismaUserToUserInfo(customerUser, prisma);
    },
  );
  if (!base) {
    return null;
  }
  return {
    ...base,
    customerId,
    tokenVersion: Number(params.tokenVersion ?? 1),
    centerUserId: Number(params.centerUserId),
  };
}

import type {
  Park,
  Role,
  User,
  UserRole,
} from '@prisma/.prisma/client/index.js';

import { prismaClient } from '~/utils/db';

// 定义令牌中用户信息的标准结构
export interface UserInfoForToken {
  id: number;
  username: string;
  realName: string;
  roles: string[];
  homePath?: string;
  parks: Array<{ parkId: number; parkName: string }>;
  reimbursementAuth?: number;
  rates?: number;
  codes: string[];
}

// Prisma返回的带有完整关联信息的用户类型 (近似表示)
// 您可能需要根据实际的Prisma查询结果调整此类型，或使用Prisma生成的类型
type PrismaRoleWithParks = Role & {
  roleCodes: Array<{ code: { code: string } }>;
  roleParks: (UserRole & {
    role: Role & {
      roleParks: { park: Park }[];
    };
  })['role']['roleParks'];
};

type UserWithFullDetails = User & {
  roles: (UserRole & {
    role: PrismaRoleWithParks;
  })[];
};

/**
 * 从数据库获取用户及其完整的角色和园区信息
 * @param username 用户名
 * @returns 用户对象或 null
 */
export async function fetchUserWithDetails(
  username: string,
): Promise<null | UserWithFullDetails> {
  return prismaClient.user.findUnique({
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
): Promise<UserInfoForToken> {
  const roles = Array.isArray(prismaUser.roles)
    ? prismaUser.roles.map((item) => item.role.name)
    : [];

  let reimbursementAuth = 0;
  let rates = 0;

  // 遍历用户所有角色，找到最高的审核权限和对应的金额
  if (Array.isArray(prismaUser.roles)) {
    for (const userRole of prismaUser.roles) {
      const role = userRole.role;
      if (
        role.reimbursementAuth &&
        role.reimbursementAuth > reimbursementAuth
      ) {
        reimbursementAuth = role.reimbursementAuth;
        rates = role.rates || 0;
      }
    }
  }

  let parks: Array<{ parkId: number; parkName: string }> = [];

  if (roles.includes('Super')) {
    const superAdminParks = await prismaClient.park.findMany({
      select: { parkId: true, parkName: true },
      where: { isDeleted: false }, // 确保只选择未删除的园区
    });
    parks = superAdminParks.map((p) => ({
      parkId: Number(p.parkId), // 确保 parkId 是字符串
      parkName: String(p.parkName),
    }));
  } else {
    const userParks = prismaUser.roles.flatMap((userRole) =>
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
  const userCodes = prismaUser.roles.flatMap((userRole) =>
    userRole.role.roleCodes.map((rc) => rc.code.code),
  );
  // 去重权限码
  const codes = [...new Set(userCodes)];

  return {
    id: Number(prismaUser.id),
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

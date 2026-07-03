import type {
  PrismaClient,
  Role,
  User,
  UserRole,
} from '@prisma/.prisma/client/index.js';

import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';
import { resolveTenantUserForCenterUser } from '~/utils/user-customer-mapping';
import { resolveUserAuthorizedParks } from '~/utils/user-park-scope';

export async function isInternalAccountPhone(
  phoneNumber: string,
  prisma: PrismaClient = prismaClient,
): Promise<boolean> {
  const normalized = phoneNumber.trim();
  if (!/^\d{11}$/.test(normalized)) {
    return false;
  }

  const user = await prisma.user.findFirst({
    select: { id: true },
    where: {
      OR: [{ phone: normalized }, { username: normalized }],
    },
  });

  return Boolean(user);
}

export interface UserInfoForToken {
  centerUserId?: number;
  codes: string[];
  customerId: string;
  homePath?: string;
  id: number;
  jti?: string;
  parks: Array<{ parkId: number; parkName: string }>;
  phone?: string;
  rates?: number;
  realName: string;
  reimbursementAuth?: number;
  roles: string[];
  tokenVersion: number;
  username: string;
}

type PrismaRoleWithDetails = Role & {
  roleCodes: Array<{
    code: null | { code: string; templateDeletedAt?: Date | null };
  }>;
};

type UserWithFullDetails = User & {
  roles: (UserRole & {
    role: null | PrismaRoleWithDetails;
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

export async function fetchUserWithDetails(
  username: string,
  prisma: PrismaClient = prismaClient,
): Promise<null | UserWithFullDetails> {
  return prisma.user.findUnique({
    include: {
      roles: {
        include: {
          role: {
            include: {
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
    where: { username },
  });
}

export async function transformPrismaUserToUserInfo(
  prismaUser: UserWithFullDetails,
  prisma: PrismaClient = prismaClient,
): Promise<UserInfoForToken> {
  const userRoles = Array.isArray(prismaUser.roles) ? prismaUser.roles : [];
  const validUserRoles = userRoles.filter(
    (item): item is UserRole & { role: PrismaRoleWithDetails } =>
      Boolean(item.role),
  );

  const roles = validUserRoles
    .map((item) => item.role.name)
    .filter(
      (name): name is string => typeof name === 'string' && name.length > 0,
    );

  let reimbursementAuth = 0;
  let rates = 0;
  for (const userRole of validUserRoles) {
    const role = userRole.role;
    const roleReimbursementAuth = Number(role.reimbursementAuth || 0);
    if (roleReimbursementAuth <= 0) {
      continue;
    }

    const roleRates = Number(role.rates || 0);
    const shouldUseRole =
      roleReimbursementAuth > reimbursementAuth ||
      (roleReimbursementAuth === reimbursementAuth &&
        (roleRates < 0 || (rates >= 0 && roleRates > rates)));

    if (shouldUseRole) {
      reimbursementAuth = roleReimbursementAuth;
      rates = roleRates;
    }
  }

  const parks = await resolveUserAuthorizedParks({
    prisma,
    roleNames: roles,
    userId: Number(prismaUser.id),
  });

  const userCodes = validUserRoles.flatMap((userRole) =>
    userRole.role.roleCodes
      .filter((rc) => !rc.code?.templateDeletedAt)
      .map((rc) => rc.code?.code)
      .filter(
        (code): code is string => typeof code === 'string' && code.length > 0,
      ),
  );
  const codes = [...new Set(userCodes)];

  const defaultCustomerId = String(
    process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  const customerId = prismaUser.customerType
    ? String(prismaUser.customerType)
    : defaultCustomerId;

  return {
    codes,
    customerId,
    homePath: prismaUser.homePath ? String(prismaUser.homePath) : undefined,
    id: Number(prismaUser.id),
    parks,
    phone: resolveUserPhoneNumber(prismaUser) || undefined,
    rates,
    realName: String(prismaUser.realName),
    reimbursementAuth,
    roles,
    tokenVersion: Number(prismaUser.tokenVersion ?? 1),
    username: String(prismaUser.username),
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
    select: { dbName: true, status: true },
    where: { customerId },
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
        dbName: params.dbName ? String(params.dbName) : null,
        prisma,
        username: String(params.username),
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
    centerUserId: Number(params.centerUserId),
    customerId,
    tokenVersion: Number(params.tokenVersion ?? 1),
  };
}

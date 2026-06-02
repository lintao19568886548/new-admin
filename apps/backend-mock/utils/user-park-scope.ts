import type { PrismaClient } from '@prisma/.prisma/client/index.js';

import { Prisma } from '@prisma/.prisma/client/index.js';
import { prismaClient } from '~/utils/db';

export interface UserParkItem {
  parkId: number;
  parkName: string;
}

export class UserParkScopeError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'UserParkScopeError';
    this.statusCode = statusCode;
  }
}

type CustomerDb = Prisma.TransactionClient | PrismaClient;

function toPositiveInteger(value: unknown) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0
    ? Math.floor(normalized)
    : null;
}

export function normalizeParkIds(input: unknown) {
  if (input === undefined || input === null) {
    return [];
  }
  if (!Array.isArray(input)) {
    throw new UserParkScopeError('园区必须是数组');
  }
  return [
    ...new Set(
      input
        .map((item) => toPositiveInteger(item))
        .filter((id): id is number => id !== null),
    ),
  ];
}

export async function assertParksAvailable(
  parkIds: number[],
  prisma: CustomerDb = prismaClient,
) {
  if (parkIds.length === 0) return;

  const parks = await prisma.park.findMany({
    select: { parkId: true },
    where: {
      isDeleted: false,
      parkId: { in: parkIds },
    },
  });
  const existingIds = new Set(parks.map((park) => Number(park.parkId)));
  const missingIds = parkIds.filter((parkId) => !existingIds.has(parkId));
  if (missingIds.length > 0) {
    throw new UserParkScopeError(
      `园区不存在或已停用：${missingIds.join(', ')}`,
    );
  }
}

export async function getUserDirectParks(
  userId: number,
  prisma: CustomerDb = prismaClient,
): Promise<UserParkItem[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      parkId: bigint | number | string;
      parkName: null | string;
    }>
  >(Prisma.sql`
    SELECT
      p.park_id AS parkId,
      p.park_name AS parkName
    FROM user_park up
    INNER JOIN park p ON p.park_id = up.park_id
    WHERE up.user_id = ${userId}
      AND up.is_deleted = false
      AND p.is_deleted = false
    ORDER BY p.park_id ASC
  `);

  return rows.map((row) => ({
    parkId: Number(row.parkId),
    parkName: String(row.parkName || ''),
  }));
}

export async function getLegacyUserPark(
  userId: number,
  prisma: CustomerDb = prismaClient,
): Promise<UserParkItem[]> {
  const user = await prisma.user.findUnique({
    select: {
      park: {
        select: {
          parkId: true,
          parkName: true,
        },
      },
      parkId: true,
    },
    where: { id: userId },
  });

  if (!user?.parkId || !user.park) {
    return [];
  }

  return [
    {
      parkId: Number(user.park.parkId),
      parkName: String(user.park.parkName || ''),
    },
  ];
}

export async function getUserRoleParks(
  userId: number,
  prisma: CustomerDb = prismaClient,
): Promise<UserParkItem[]> {
  const userRoles = await prisma.userRole.findMany({
    include: {
      role: {
        include: {
          roleParks: {
            include: {
              park: {
                select: {
                  parkId: true,
                  parkName: true,
                },
              },
            },
            where: { isDeleted: false },
          },
        },
      },
    },
    where: { userId },
  });

  const parks = userRoles.flatMap((userRole) =>
    (userRole.role?.roleParks || [])
      .filter((rolePark) => rolePark.park)
      .map((rolePark) => ({
        parkId: Number(rolePark.park.parkId),
        parkName: String(rolePark.park.parkName || ''),
      })),
  );

  return dedupeParks(parks);
}

export function dedupeParks(parks: UserParkItem[]) {
  const map = new Map<number, UserParkItem>();
  parks.forEach((park) => {
    if (Number.isInteger(park.parkId) && park.parkId > 0) {
      map.set(park.parkId, park);
    }
  });
  return [...map.values()];
}

export async function resolveUserAuthorizedParks(params: {
  prisma?: CustomerDb;
  roleNames?: string[];
  userId: number;
}) {
  const prisma = params.prisma ?? prismaClient;
  const roleNames = Array.isArray(params.roleNames) ? params.roleNames : [];

  if (roleNames.includes('Super')) {
    const allParks = await prisma.park.findMany({
      orderBy: { parkId: 'asc' },
      select: { parkId: true, parkName: true },
      where: { isDeleted: false },
    });
    return allParks.map((park) => ({
      parkId: Number(park.parkId),
      parkName: String(park.parkName || ''),
    }));
  }

  const directParks = await getUserDirectParks(params.userId, prisma).catch(
    (error) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2010'
      ) {
        return [];
      }
      throw error;
    },
  );
  if (directParks.length > 0) {
    return dedupeParks(directParks);
  }

  const legacyUserPark = await getLegacyUserPark(params.userId, prisma);
  if (legacyUserPark.length > 0) {
    return dedupeParks(legacyUserPark);
  }

  return getUserRoleParks(params.userId, prisma);
}

export async function syncUserParks(params: {
  parkIds: number[];
  prisma?: CustomerDb;
  userId: number;
}) {
  const prisma = params.prisma ?? prismaClient;
  const userId = Number(params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new UserParkScopeError('账号ID不合法');
  }

  const parkIds = [...new Set(params.parkIds)];
  await assertParksAvailable(parkIds, prisma);

  if (parkIds.length === 0) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE user_park
      SET is_deleted = true
      WHERE user_id = ${userId}
    `);
    return;
  }

  await prisma.$executeRaw(Prisma.sql`
    UPDATE user_park
    SET is_deleted = true
    WHERE user_id = ${userId}
      AND park_id NOT IN (${Prisma.join(parkIds)})
  `);

  await prisma.$executeRaw(Prisma.sql`
    UPDATE user_park
    SET is_deleted = false
    WHERE user_id = ${userId}
      AND park_id IN (${Prisma.join(parkIds)})
  `);

  const existingRows = await prisma.$queryRaw<Array<{ parkId: number }>>(
    Prisma.sql`
      SELECT park_id AS parkId
      FROM user_park
      WHERE user_id = ${userId}
        AND park_id IN (${Prisma.join(parkIds)})
    `,
  );
  const existingIds = new Set(existingRows.map((row) => Number(row.parkId)));
  const idsToCreate = parkIds.filter((parkId) => !existingIds.has(parkId));

  for (const parkId of idsToCreate) {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO user_park (user_id, park_id, is_deleted)
      VALUES (${userId}, ${parkId}, false)
    `);
  }
}

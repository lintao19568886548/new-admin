import type { PrismaClient } from '@prisma/.prisma/client/index.js';

import { systemDbClient } from '~/utils/db';

export async function resolveTenantUserForCenterUser(params: {
  centerUserId: number;
  customerId: string;
  dbName: null | string;
  prisma: PrismaClient;
  username: string;
}): Promise<null | { customerUserId: number; username: string }> {
  const centerUserId = Number(params.centerUserId);
  if (!Number.isFinite(centerUserId) || centerUserId <= 0) {
    return null;
  }
  const customerId = String(params.customerId || '').trim();
  if (!customerId) {
    return null;
  }
  const username = String(params.username || '').trim();
  if (!username) {
    return null;
  }

  const readMapping = async () => {
    return systemDbClient.userCustomerMapping.findUnique({
      where: { centerUserId_customerId: { centerUserId, customerId } },
      select: { customerUserId: true },
    });
  };

  const mapping = await readMapping();
  let customerUserId = mapping?.customerUserId ?? null;

  if (!customerUserId) {
    const userByUsername = await params.prisma.user.findUnique({
      where: { username },
      select: { id: true, status: true },
    });
    if (!userByUsername) {
      return null;
    }
    if (Number(userByUsername.status ?? 1) !== 1) {
      return null;
    }

    await systemDbClient.userCustomerMapping
      .create({
        data: {
          centerUserId,
          customerId,
          customerUserId: Number(userByUsername.id),
          dbName: params.dbName ? String(params.dbName) : null,
        },
      })
      .catch(() => undefined);

    const mappingAfterCreate = await readMapping();
    customerUserId = mappingAfterCreate?.customerUserId ?? null;
  }

  if (!customerUserId) {
    return null;
  }

  const userById = await params.prisma.user.findUnique({
    where: { id: Number(customerUserId) },
    select: { username: true, status: true },
  });
  if (!userById) {
    return null;
  }
  if (Number(userById.status ?? 1) !== 1) {
    return null;
  }

  const mappedUsername = String(userById.username || '').trim();
  if (!mappedUsername) {
    return null;
  }

  return { customerUserId: Number(customerUserId), username: mappedUsername };
}

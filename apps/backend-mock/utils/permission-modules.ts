import type { PrismaClient } from '@prisma/.prisma/client/index.js';

import { prismaClient } from '~/utils/db';

export async function applyUserRolesToUser(params: {
  prisma?: PrismaClient;
  roleIds: number[];
  userId: number;
}): Promise<{ roleIds: number[] }> {
  const prisma = params.prisma ?? prismaClient;
  const resolvedRoleIds = [...new Set(params.roleIds)]
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);

  if (resolvedRoleIds.length > 0) {
    const existingUserRoles = await prisma.userRole.findMany({
      where: {
        userId: params.userId,
        roleId: {
          in: resolvedRoleIds,
        },
      },
      select: {
        roleId: true,
      },
    });

    const existingRoleIds = new Set(
      existingUserRoles.map((item) => item.roleId),
    );
    const roleIdsToCreate = resolvedRoleIds.filter(
      (id) => !existingRoleIds.has(id),
    );

    if (roleIdsToCreate.length > 0) {
      await prisma.userRole.createMany({
        data: roleIdsToCreate.map((roleId) => ({
          userId: params.userId,
          roleId,
        })),
      });
    }
  }

  return {
    roleIds: resolvedRoleIds,
  };
}

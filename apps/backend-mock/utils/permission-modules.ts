import { prismaClient } from '~/utils/db';

export async function applyUserRolesToUser(params: {
  roleIds: number[];
  userId: number;
}): Promise<{ roleIds: number[] }> {
  const resolvedRoleIds = [...new Set(params.roleIds)]
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);

  if (resolvedRoleIds.length > 0) {
    const existingUserRoles = await prismaClient.userRole.findMany({
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
      await prismaClient.userRole.createMany({
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

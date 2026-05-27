import { verifyAccessToken } from '~/utils/jwt-utils';
import { bumpPermissionCacheVersion } from '~/utils/permission-cache';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';
import {
  assertRoleInScope,
  noRoleScopeResponse,
  resolveRoleScopeContext,
} from '~/utils/role-scope';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const customerId = String(userinfo.customerId);
  const roleScope = await resolveRoleScopeContext(userinfo);
  if (!roleScope) {
    return noRoleScopeResponse(event);
  }
  const id = event.context.params?.id;
  if (!id) {
    return useResponseError('id is required', 400);
  }
  const body = await readBody(event);
  const { permissions, batchRoleIds } = body;

  if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
    return useResponseError(
      'permissions are required and should be an array.',
      400,
    );
  }

  try {
    const res = await prismaClient.$transaction(async (prisma) => {
      await assertRoleInScope({
        context: roleScope,
        roleId: Number(id),
        roleModel: prisma.role,
      });
      // 1. 安全验证：检查子角色权限是否超出父角色范围
      const role = await prisma.role.findUnique({
        where: { roleId: Number(id) },
      });

      if (!role) {
        throw new Error(`Role with id ${id} not found.`);
      }

      if (role.parentId) {
        const parentRole = await prisma.role.findUnique({
          where: { roleId: role.parentId },
          include: {
            roleMenus: {
              where: { isDeleted: false },
              select: { menuId: true },
            },
          },
        });

        if (parentRole) {
          const parentMenuIds = new Set(
            parentRole.roleMenus.map((rm) => rm.menuId),
          );
          const requestedMenuIds = permissions.map(Number);

          const parentIsInBatch =
            batchRoleIds &&
            Array.isArray(batchRoleIds) &&
            batchRoleIds.map(String).includes(String(role.parentId));

          // If the parent is also part of the batch update,
          // temporarily add the new permissions to the parent's permission set for validation purposes.
          if (parentIsInBatch) {
            requestedMenuIds.forEach((menuId) => {
              parentMenuIds.add(menuId);
            });
          }

          const invalidMenuIds = requestedMenuIds.filter(
            (menuId) => !parentMenuIds.has(menuId),
          );

          if (invalidMenuIds.length > 0) {
            throw new Error(
              `子角色权限不能超出父角色范围。无效的菜单ID: ${invalidMenuIds.join(
                ', ',
              )}`,
            );
          }
        }
      }

      // 2. 获取当前角色已有的菜单关联
      const existingRoleMenus = await prisma.roleMenu.findMany({
        where: {
          roleId: Number(id),
        },
        select: {
          menuId: true,
          isDeleted: true,
        },
      });

      const existingMenuIds = new Set(
        existingRoleMenus.filter((rm) => !rm.isDeleted).map((rm) => rm.menuId),
      );
      const softDeletedMenuIds = new Set(
        existingRoleMenus.filter((rm) => rm.isDeleted).map((rm) => rm.menuId),
      );

      const newMenuIds = permissions.map(Number);

      // 3. 找出需要添加的菜单关联
      const menuIdsToAdd = newMenuIds.filter(
        (menuId) => !existingMenuIds.has(menuId),
      );

      // 4. 添加新的菜单关联
      if (menuIdsToAdd.length > 0) {
        // 检查是否有被软删除的记录可以恢复
        const menuIdsToRecover = menuIdsToAdd.filter((menuId) =>
          softDeletedMenuIds.has(menuId),
        );

        if (menuIdsToRecover.length > 0) {
          await prisma.roleMenu.updateMany({
            where: {
              roleId: Number(id),
              menuId: {
                in: menuIdsToRecover,
              },
            },
            data: {
              isDeleted: false,
            },
          });
        }

        // 创建新记录（排除已恢复的记录）
        const menuIdsToCreate = menuIdsToAdd.filter(
          (menuId) => !menuIdsToRecover.includes(menuId),
        );

        if (menuIdsToCreate.length > 0) {
          await prisma.roleMenu.createMany({
            data: menuIdsToCreate.map((menuId) => ({
              roleId: Number(id),
              menuId,
            })),
          });
        }
      }
    });

    await bumpPermissionCacheVersion(customerId).catch(() => undefined);
    return useResponseSuccess(res);
  } catch (error: any) {
    console.error('添加权限失败:', error);
    return useResponseError(error.message || '添加权限失败', 500);
  }
});

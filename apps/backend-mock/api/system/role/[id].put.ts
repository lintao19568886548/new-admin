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
  const {
    organizationId: _organizationId,
    permissions,
    parkIds,
    parentId,
    scope: _scope,
    ...roleData
  } = body;
  // roleData.status = !!roleData.status;
  if (roleData.status) {
    roleData.status = Boolean(roleData.status);
  }
  try {
    const res = await prismaClient.$transaction(async (prisma) => {
      await assertRoleInScope({
        context: roleScope,
        roleId: Number(id),
        roleModel: prisma.role,
      });
      if (parentId) {
        await assertRoleInScope({
          context: roleScope,
          roleId: Number(parentId),
          roleModel: prisma.role,
        });
      }

      // 1. 更新角色基本信息
      await prisma.role.update({
        where: {
          roleId: Number(id),
        },
        data: {
          ...roleData,
          parent: parentId // 处理 parentId 更新
            ? {
                connect: { roleId: Number(parentId) },
              }
            : undefined,
        },
      });

      // 2. 如果提供了permissions，则更新角色菜单关联
      if (permissions && Array.isArray(permissions)) {
        // 2.0 安全验证：检查子角色权限是否超出父角色范围
        if (parentId) {
          // 获取父角色的权限信息
          const parentRole = await prisma.role.findUnique({
            where: { roleId: Number(parentId) },
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

            // 检查是否有超出父角色权限范围的菜单ID
            const invalidMenuIds = requestedMenuIds.filter(
              (menuId) => !parentMenuIds.has(menuId),
            );

            if (invalidMenuIds.length > 0) {
              throw new Error(
                `子角色权限不能超出父角色范围。无效的菜单ID: ${invalidMenuIds.join(', ')}`,
              );
            }
          }
        }

        // 2.1 获取当前角色已有的菜单关联
        const existingRoleMenus = await prisma.roleMenu.findMany({
          where: {
            roleId: Number(id),
            isDeleted: false, // 只查询未删除的记录
          },
          select: {
            menuId: true,
          },
        });

        const existingMenuIds = existingRoleMenus.map((rm) => rm.menuId);
        const newMenuIds = permissions.map(Number);

        // 2.2 找出需要删除的菜单关联（在现有列表中但不在新列表中）
        const menuIdsToDelete = existingMenuIds.filter(
          (menuId) => !newMenuIds.includes(menuId),
        );

        // 2.3 找出需要添加的菜单关联（在新列表中但不在现有列表中）
        const menuIdsToAdd = newMenuIds.filter(
          (menuId) => !existingMenuIds.includes(menuId),
        );

        // 2.4 删除不再需要的菜单关联
        if (menuIdsToDelete.length > 0) {
          // 将硬删除改为软删除
          await prisma.roleMenu.updateMany({
            where: {
              roleId: Number(id),
              menuId: {
                in: menuIdsToDelete,
              },
            },
            data: {
              isDeleted: true,
            },
          });
        }

        // 2.5 添加新的菜单关联
        if (menuIdsToAdd.length > 0) {
          // 检查是否有被软删除的记录可以恢复
          const deletedRecords = await prisma.roleMenu.findMany({
            where: {
              roleId: Number(id),
              menuId: {
                in: menuIdsToAdd,
              },
              isDeleted: true,
            },
          });

          // 恢复已软删除的记录
          const deletedMenuIds = deletedRecords.map((record) => record.menuId);
          if (deletedMenuIds.length > 0) {
            await prisma.roleMenu.updateMany({
              where: {
                roleId: Number(id),
                menuId: {
                  in: deletedMenuIds,
                },
              },
              data: {
                isDeleted: false,
              },
            });
          }

          // 创建新记录（排除已恢复的记录）
          const menuIdsToCreate = menuIdsToAdd.filter(
            (menuId) => !deletedMenuIds.includes(menuId),
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
      }

      // 3. 如果提供了parkIds，则更新角色园区关联
      if (parkIds && Array.isArray(parkIds)) {
        // 3.1 获取当前角色已有的园区关联
        const existingRoleParks = await prisma.rolePark.findMany({
          where: {
            roleId: Number(id),
            isDeleted: false, // 只查询未删除的记录
          },
          select: {
            parkId: true,
          },
        });
        const existingParkIds = existingRoleParks.map((rp) => rp.parkId);
        const newParkIds = parkIds.map(Number);
        // 3.2 找出需要删除的园区关联（在现有列表中但不在新列表中）
        const parkIdsToDelete = existingParkIds.filter(
          (parkId) => !newParkIds.includes(parkId),
        );
        // 3.3 找出需要添加的园区关联（在新列表中但不在现有列表中）
        const parkIdsToAdd = newParkIds.filter(
          (parkId) => !existingParkIds.includes(parkId),
        );
        // 3.4 删除不再需要的园区关联
        if (parkIdsToDelete.length > 0) {
          // 将硬删除改为软删除
          await prisma.rolePark.updateMany({
            where: {
              roleId: Number(id),
              parkId: {
                in: parkIdsToDelete,
              },
            },
            data: {
              isDeleted: true,
            },
          });
        }
        // 3.5 添加新的园区关联
        if (parkIdsToAdd.length > 0) {
          // 检查是否有被软删除的记录可以恢复
          const deletedRecords = await prisma.rolePark.findMany({
            where: {
              roleId: Number(id),
              parkId: {
                in: parkIdsToAdd,
              },
              isDeleted: true, // 添加这个条件，只查询已软删除的记录
            },
          });
          // 恢复已软删除的记录
          const deletedParkIds = deletedRecords.map((record) => record.parkId);
          if (deletedParkIds.length > 0) {
            await prisma.rolePark.updateMany({
              where: {
                roleId: Number(id),
                parkId: {
                  in: deletedParkIds,
                },
              },
              data: {
                isDeleted: false,
              },
            });
          }

          // 创建新记录（排除已恢复的记录）
          const parkIdsToCreate = parkIdsToAdd.filter(
            (parkId) => !deletedParkIds.includes(parkId),
          );

          if (parkIdsToCreate.length > 0) {
            await prisma.rolePark.createMany({
              data: parkIdsToCreate.map((parkId) => ({
                roleId: Number(id),
                parkId,
              })),
            });
          }
        }
      }
    });

    await bumpPermissionCacheVersion(customerId).catch(() => undefined);
    return useResponseSuccess(res);
  } catch (error) {
    console.error('更新数据失败:', error);
    return useResponseError('更新数据失败', 500);
  }
});

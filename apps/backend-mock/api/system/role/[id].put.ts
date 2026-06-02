import { verifyAccessToken } from '~/utils/jwt-utils';
import { bumpPermissionCacheVersion } from '~/utils/permission-cache';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import {
  assertRoleInScope,
  noRoleScopeResponse,
  resolveRoleScopeContext,
} from '~/utils/role-scope';

class RoleWriteRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'RoleWriteRequestError';
    this.statusCode = statusCode;
  }
}

function hasOwn(data: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function normalizeBoolean(value: unknown, label: string) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true'].includes(normalized)) return true;
    if (['0', 'false'].includes(normalized)) return false;
  }
  throw new RoleWriteRequestError(`${label}只能是启用或禁用`);
}

function normalizePositiveId(value: unknown, label: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new RoleWriteRequestError(`${label}ID无效`);
  }
  return id;
}

function normalizeOptionalPositiveId(value: unknown, label: string) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return normalizePositiveId(value, label);
}

function normalizeIdList(value: unknown, label: string) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new RoleWriteRequestError(`${label}必须是数组`);
  }
  return [...new Set(value.map((item) => normalizePositiveId(item, label)))];
}

async function assertMenusExist(prisma: any, menuIds: number[]) {
  if (menuIds.length === 0) return;

  const menus = await prisma.menu.findMany({
    where: { menuId: { in: menuIds } },
    select: { menuId: true },
  });
  const existingIds = new Set(
    menus.map((menu: { menuId: number }) => menu.menuId),
  );
  const missingIds = menuIds.filter((menuId) => !existingIds.has(menuId));

  if (missingIds.length > 0) {
    throw new RoleWriteRequestError(
      `权限项不存在或已不是可配置权限：${missingIds.join(', ')}`,
    );
  }
}

async function assertParksExist(prisma: any, parkIds: number[]) {
  if (parkIds.length === 0) return;

  const parks = await prisma.park.findMany({
    where: {
      isDeleted: false,
      parkId: { in: parkIds },
    },
    select: { parkId: true },
  });
  const existingIds = new Set(
    parks.map((park: { parkId: number }) => park.parkId),
  );
  const missingIds = parkIds.filter((parkId) => !existingIds.has(parkId));

  if (missingIds.length > 0) {
    throw new RoleWriteRequestError(
      `园区不存在或已停用：${missingIds.join(', ')}`,
    );
  }
}

async function assertPermissionsWithinParent(
  prisma: any,
  parentRoleId: number | undefined,
  menuIds: number[],
) {
  if (parentRoleId === undefined || menuIds.length === 0) return;

  const parentRole = await prisma.role.findUnique({
    where: { roleId: parentRoleId },
    include: {
      roleMenus: {
        where: { isDeleted: false },
        select: { menuId: true },
      },
    },
  });
  if (!parentRole) return;

  const parentMenuIds = new Set(
    parentRole.roleMenus.map((roleMenu: { menuId: number }) => roleMenu.menuId),
  );
  const invalidMenuIds = menuIds.filter((menuId) => !parentMenuIds.has(menuId));
  if (invalidMenuIds.length > 0) {
    throw new RoleWriteRequestError(
      `子角色权限不能超出父角色范围，无效权限ID：${invalidMenuIds.join(', ')}`,
    );
  }
}

async function syncRoleMenus(
  prisma: any,
  roleId: number,
  nextMenuIds: number[],
) {
  const existingRoleMenus = await prisma.roleMenu.findMany({
    where: { isDeleted: false, roleId },
    select: { menuId: true },
  });

  const existingMenuIds = existingRoleMenus.map(
    (roleMenu: { menuId: number }) => roleMenu.menuId,
  );
  const menuIdsToDelete = existingMenuIds.filter(
    (menuId: number) => !nextMenuIds.includes(menuId),
  );
  const menuIdsToAdd = nextMenuIds.filter(
    (menuId) => !existingMenuIds.includes(menuId),
  );

  if (menuIdsToDelete.length > 0) {
    await prisma.roleMenu.updateMany({
      data: { isDeleted: true },
      where: { menuId: { in: menuIdsToDelete }, roleId },
    });
  }

  if (menuIdsToAdd.length === 0) return;

  const deletedRecords = await prisma.roleMenu.findMany({
    where: {
      isDeleted: true,
      menuId: { in: menuIdsToAdd },
      roleId,
    },
  });
  const deletedMenuIds = deletedRecords.map(
    (record: { menuId: number }) => record.menuId,
  );

  if (deletedMenuIds.length > 0) {
    await prisma.roleMenu.updateMany({
      data: { isDeleted: false },
      where: { menuId: { in: deletedMenuIds }, roleId },
    });
  }

  const menuIdsToCreate = menuIdsToAdd.filter(
    (menuId) => !deletedMenuIds.includes(menuId),
  );
  if (menuIdsToCreate.length > 0) {
    await prisma.roleMenu.createMany({
      data: menuIdsToCreate.map((menuId) => ({ menuId, roleId })),
    });
  }
}

async function syncRoleParks(
  prisma: any,
  roleId: number,
  nextParkIds: number[],
) {
  const existingRoleParks = await prisma.rolePark.findMany({
    where: { isDeleted: false, roleId },
    select: { parkId: true },
  });

  const existingParkIds = existingRoleParks.map(
    (rolePark: { parkId: number }) => rolePark.parkId,
  );
  const parkIdsToDelete = existingParkIds.filter(
    (parkId: number) => !nextParkIds.includes(parkId),
  );
  const parkIdsToAdd = nextParkIds.filter(
    (parkId) => !existingParkIds.includes(parkId),
  );

  if (parkIdsToDelete.length > 0) {
    await prisma.rolePark.updateMany({
      data: { isDeleted: true },
      where: { parkId: { in: parkIdsToDelete }, roleId },
    });
  }

  if (parkIdsToAdd.length === 0) return;

  const deletedRecords = await prisma.rolePark.findMany({
    where: {
      isDeleted: true,
      parkId: { in: parkIdsToAdd },
      roleId,
    },
  });
  const deletedParkIds = deletedRecords.map(
    (record: { parkId: number }) => record.parkId,
  );

  if (deletedParkIds.length > 0) {
    await prisma.rolePark.updateMany({
      data: { isDeleted: false },
      where: { parkId: { in: deletedParkIds }, roleId },
    });
  }

  const parkIdsToCreate = parkIdsToAdd.filter(
    (parkId) => !deletedParkIds.includes(parkId),
  );
  if (parkIdsToCreate.length > 0) {
    await prisma.rolePark.createMany({
      data: parkIdsToCreate.map((parkId) => ({ parkId, roleId })),
    });
  }
}

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
    return badRequestResponse('id is required', event);
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

  try {
    const roleId = normalizePositiveId(id, '角色');
    const parentRoleId = normalizeOptionalPositiveId(parentId, '上级角色');
    const nextMenuIds = normalizeIdList(permissions, '权限');
    const nextParkIds = normalizeIdList(parkIds, '园区');

    if (hasOwn(roleData, 'status')) {
      roleData.status = normalizeBoolean(roleData.status, '角色状态');
    }

    const res = await prismaClient.$transaction(async (prisma) => {
      await assertRoleInScope({
        context: roleScope,
        roleId,
        roleModel: prisma.role,
      });

      if (parentRoleId !== undefined) {
        await assertRoleInScope({
          context: roleScope,
          roleId: parentRoleId,
          roleModel: prisma.role,
        });
      }

      await prisma.role.update({
        data: {
          ...roleData,
          parent:
            parentRoleId === undefined
              ? undefined
              : { connect: { roleId: parentRoleId } },
        },
        where: { roleId },
      });

      if (nextMenuIds !== undefined) {
        await assertMenusExist(prisma, nextMenuIds);
        await assertPermissionsWithinParent(prisma, parentRoleId, nextMenuIds);
        await syncRoleMenus(prisma, roleId, nextMenuIds);
      }

      if (nextParkIds !== undefined) {
        await assertParksExist(prisma, nextParkIds);
        await syncRoleParks(prisma, roleId, nextParkIds);
      }
    });

    await bumpPermissionCacheVersion(customerId).catch(() => undefined);
    return useResponseSuccess(res);
  } catch (error) {
    if (error instanceof RoleWriteRequestError) {
      return badRequestResponse(error.message, event, error.statusCode);
    }

    console.error('更新角色权限失败:', error);
    return serverErrorResponse('更新角色权限失败，请稍后重试', event);
  }
});

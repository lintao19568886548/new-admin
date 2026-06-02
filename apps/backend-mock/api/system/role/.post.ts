import { verifyAccessToken } from '~/utils/jwt-utils';
import { bumpPermissionCacheVersion } from '~/utils/permission-cache';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import {
  applyRoleScopeCreateData,
  assertRoleInScope,
  noRoleScopeResponse,
  resolveRoleScopeContext,
} from '~/utils/role-scope';

class RoleCreateRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'RoleCreateRequestError';
    this.statusCode = statusCode;
  }
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
  throw new RoleCreateRequestError(`${label}只能是启用或禁用`);
}

function normalizePositiveId(value: unknown, label: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new RoleCreateRequestError(`${label}ID无效`);
  }
  return id;
}

function normalizeOptionalPositiveId(value: unknown, label: string) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return normalizePositiveId(value, label);
}

function normalizeIdList(value: unknown, label: string) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new RoleCreateRequestError(`${label}必须是数组`);
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
    throw new RoleCreateRequestError(
      `权限项不存在或已不是可配置权限：${missingIds.join(', ')}`,
    );
  }
}

async function assertParksExist(prisma: any, parkIds: number[]) {
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
    throw new RoleCreateRequestError(
      `园区不存在或已停用：${missingIds.join(', ')}`,
    );
  }
}

async function assertPermissionsWithinParent(
  prisma: any,
  parentRoleId: null | number,
  menuIds: number[],
) {
  if (parentRoleId === null || menuIds.length === 0) return;

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
    throw new RoleCreateRequestError(
      `子角色权限不能超出父角色范围，无效权限ID：${invalidMenuIds.join(', ')}`,
    );
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
    const parentIdValue = normalizeOptionalPositiveId(parentId, '上级角色');
    const menuIds = normalizeIdList(permissions, '权限');
    const normalizedParkIds = normalizeIdList(parkIds, '园区');

    if (normalizedParkIds.length === 0) {
      throw new RoleCreateRequestError('创建角色必须选择所属园区');
    }

    const dataToCreate: any = {
      ...roleData,
      status:
        roleData.status === undefined
          ? true
          : normalizeBoolean(roleData.status, '角色状态'),
    };

    if (parentIdValue !== null) {
      await assertRoleInScope({
        context: roleScope,
        roleId: parentIdValue,
      });
      dataToCreate.parentId = parentIdValue;
    }

    const scopedDataToCreate = applyRoleScopeCreateData(
      dataToCreate,
      roleScope,
    );

    const res = await prismaClient.$transaction(async (prisma) => {
      await assertMenusExist(prisma, menuIds);
      await assertParksExist(prisma, normalizedParkIds);
      await assertPermissionsWithinParent(prisma, parentIdValue, menuIds);

      const newRole = await prisma.role.create({
        data: scopedDataToCreate,
      });

      if (menuIds.length > 0) {
        await prisma.roleMenu.createMany({
          data: menuIds.map((menuId) => ({
            isDeleted: false,
            menuId,
            roleId: newRole.roleId,
          })),
        });
      }

      await prisma.rolePark.createMany({
        data: normalizedParkIds.map((parkId) => ({
          isDeleted: false,
          parkId,
          roleId: newRole.roleId,
        })),
      });

      return newRole;
    });

    await bumpPermissionCacheVersion(customerId).catch(() => undefined);
    return useResponseSuccess(res);
  } catch (error) {
    if (error instanceof RoleCreateRequestError) {
      return badRequestResponse(error.message, event, error.statusCode);
    }

    console.error('创建角色失败:', error);
    return serverErrorResponse('创建角色失败，请稍后重试', event);
  }
});

import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody(event);
  const { permissions, parkIds, parentId, ...roleData } = body;
  roleData.status = !!roleData.status;

  // 如果提供了 parentid，确保它是数字或 null
  const parentIdValue = parentId ? Number(parentId) : null;

  // 准备要创建的角色数据
  const dataToCreate: any = {
    ...roleData,
    status: roleData.status, // 确保 status 是布尔值
  };

  // 只有在 parentIdValue 不为 null 时才添加到 dataToCreate 中
  if (parentIdValue !== null) {
    dataToCreate.parentId = parentIdValue;
  }

  try {
    const res = await prismaClient.$transaction(async (prisma) => {
      // 1. 创建角色基本信息
      const newRole = await prisma.role.create({
        data: dataToCreate, // 使用包含 parentId 的数据
      });

      // 2. 如果提供了permissions，则创建角色菜单关联
      if (permissions && Array.isArray(permissions)) {
        // 2.0 安全验证：检查子角色权限是否超出父角色范围
        if (parentIdValue) {
          // 获取父角色的权限信息
          const parentRole = await prisma.role.findUnique({
            where: { roleId: parentIdValue },
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

        const menuIds = permissions.map(Number);

        if (menuIds.length > 0) {
          await prisma.roleMenu.createMany({
            data: menuIds.map((menuId) => ({
              roleId: newRole.roleId,
              menuId,
              isDeleted: false,
            })),
          });
        }
      }

      if (parkIds && Array.isArray(parkIds)) {
        await prisma.rolePark.createMany({
          data: parkIds.map((parkId) => ({
            roleId: newRole.roleId,
            parkId,
            isDeleted: false,
          })),
        });
      }
    });

    return useResponseSuccess(res);
  } catch (error) {
    console.error('创建角色失败:', error);
    return useResponseError('创建角色失败', 500);
  }
});

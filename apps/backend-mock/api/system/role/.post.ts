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
  const { permissions, parkIds, parentid, ...roleData } = body;
  roleData.status = !!roleData.status;

  // 如果提供了 parentid，确保它是数字或 null
  const parentIdValue = parentid ? Number(parentid) : null;

  // 准备要创建的角色数据
  const dataToCreate: any = {
    ...roleData,
    status: roleData.status, // 确保 status 是布尔值
  };

  // 只有在 parentIdValue 不为 null 时才添加到 dataToCreate 中
  if (parentIdValue !== null) {
    dataToCreate.parentid = parentIdValue;
  }

  try {
    const res = await prismaClient.$transaction(async (prisma) => {
      // 1. 创建角色基本信息
      const newRole = await prisma.role.create({
        data: dataToCreate, // 使用包含 parentid 的数据
      });

      // 2. 如果提供了permissions，则创建角色菜单关联
      if (permissions && Array.isArray(permissions)) {
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

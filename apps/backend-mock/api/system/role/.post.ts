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
  const { permissions, ...roleData } = body;
  roleData.status = !!roleData.status;

  try {
    const res = await prismaClient.$transaction(async (prisma) => {
      // 1. 创建角色基本信息
      const newRole = await prisma.role.create({
        data: roleData,
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
    });

    return useResponseSuccess(res);
  } catch (error) {
    console.error('创建角色失败:', error);
    return useResponseError('创建角色失败', 500);
  }
});

import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // 获取用户ID
  const userId = userinfo.id;

  // 检查是否有Super角色权限
  const roleNames = userinfo.roles;
  const hasSuperRole = roleNames.includes('Super');

  // 如果有Super权限，直接查询所有
  if (hasSuperRole) {
    const allParks = await prismaClient.park.findMany({
      where: {
        isDeleted: false,
      },
      select: { parkId: true, parkName: true },
    });
    return useResponseSuccess(allParks);
  }

  // 根据userId查询用户角色
  const userRoles = await prismaClient.userRole.findMany({
    where: {
      userId,
    },
    include: {
      role: true,
    },
  });

  // 获取角色ID列表
  const roleIds = userRoles.map((ur) => ur.roleId);

  // 根据角色ID查询关联的园区
  const roleParks = await prismaClient.rolePark.findMany({
    where: {
      roleId: {
        in: roleIds,
      },
    },
    select: {
      parkId: true,
    },
  });

  // 提取园区ID
  const parkIds = roleParks.map((rp) => rp.parkId);

  // 如果没有关联的园区，返回空数组
  if (parkIds.length === 0) {
    return useResponseSuccess([]);
  }

  // 查询园区信息
  const parks = await prismaClient.park.findMany({
    where: {
      parkId: {
        in: parkIds,
      },
      isDeleted: false,
    },
    select: {
      parkId: true,
      parkName: true,
    },
  });

  return useResponseSuccess(parks);
});

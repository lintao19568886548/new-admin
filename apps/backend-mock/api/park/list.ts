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

  // 非Super角色，需要查询用户关联的园区
  try {
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

    // 如果用户没有任何角色，返回空数组
    if (roleIds.length === 0) {
      console.log(`用户 ${userId} 没有任何角色，返回空园区列表`);
      return useResponseSuccess([]);
    }

    // 根据角色ID查询关联的园区
    const roleParks = await prismaClient.rolePark.findMany({
      where: {
        roleId: {
          in: roleIds,
        },
        isDeleted: false,
      },
      select: {
        parkId: true,
      },
    });

    // 提取园区ID
    const parkIds = roleParks.map((rp) => rp.parkId);

    // 如果没有关联的园区，返回空数组
    if (parkIds.length === 0) {
      console.log(`用户 ${userId} 的角色没有关联任何园区，返回空园区列表`);
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
  } catch (error) {
    console.error(`查询用户 ${userId} 关联园区时出错:`, error);
    // 发生错误时返回空数组，而不是所有园区
    return useResponseSuccess([]);
  }
});

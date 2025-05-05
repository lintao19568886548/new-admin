import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // 检查是否有Super角色权限
  const roleNames = userinfo.roles;
  const hasSuperRole = roleNames.includes('Super');

  // 如果有Super权限，直接查询所有
  if (hasSuperRole) {
    const allMenus = await prismaClient.park.findMany({
      where: {
        isDeleted: false,
      },
      select: { parkId: true, parkName: true },
    });
    return useResponseSuccess(allMenus);
  }

  // 构建查询条件
  const where: any = {};

  const parks = await prismaClient.park.findMany({
    where: {
      isDeleted: false,
      parkName: {
        in: userinfo.parks.map((park) => park.parkName),
      },
    },
    select: { parkId: true, parkName: true },
  });

  if (parks.length > 0) {
    where.parkId = {
      in: parks.map((park) => park.parkId),
    };
  }

  return useResponseSuccess(parks);
});

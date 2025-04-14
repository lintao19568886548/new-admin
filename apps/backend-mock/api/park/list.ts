import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // 构建查询条件
  const where: any = {};

  const parks = await prismaClient.park.findMany({
    where: {
      parkName: {
        in: userinfo.parks,
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

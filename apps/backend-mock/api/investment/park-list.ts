import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const parks = await runWithRadarSharedScope(() =>
    prismaClient.park.findMany({
      orderBy: {
        parkId: 'asc',
      },
      select: {
        parkId: true,
        parkName: true,
      },
      where: {
        isDeleted: false,
      },
    }),
  );

  return useResponseSuccess(parks);
});

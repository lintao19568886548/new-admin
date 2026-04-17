import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const accessibleParkIds = (userinfo.parks || [])
      .map((park: { parkId: number }) => Number(park.parkId))
      .filter((parkId: number) => Number.isInteger(parkId) && parkId > 0);

    if (accessibleParkIds.length === 0) {
      return useResponseSuccess({ deletedCount: 0 });
    }

    const result = await prismaClient.finance.updateMany({
      where: {
        isDeleted: false,
        parkId: {
          in: accessibleParkIds,
        },
      },
      data: {
        isDeleted: true,
      },
    });

    return useResponseSuccess({
      deletedCount: Number(result.count || 0),
    });
  } catch (error) {
    console.error('批量删除财务数据失败:', error);
    return serverErrorResponse('批量删除财务数据失败', event);
  }
});

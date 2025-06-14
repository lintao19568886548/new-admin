import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const parks = await prismaClient.park.findMany({
      where: {
        isDeleted: false,
      },
      select: {
        parkId: true,
        parkName: true,
      },
    });
    return useResponseSuccess(parks);
  } catch (error) {
    console.error('获取园区列表失败:', error);
    return serverErrorResponse('获取园区列表失败', event);
  }
});

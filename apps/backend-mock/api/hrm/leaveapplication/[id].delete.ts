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

  const { id } = getRouterParams(event);

  if (!id || Number.isNaN(Number(id))) {
    return serverErrorResponse('无效的ID', event);
  }

  try {
    await prismaClient.leaveApplication.delete({
      where: {
        id: Number(id),
      },
    });
    return useResponseSuccess(null);
  } catch (error) {
    console.error('删除请假申请失败:', error);
    return serverErrorResponse('删除请假申请失败', event);
  }
});

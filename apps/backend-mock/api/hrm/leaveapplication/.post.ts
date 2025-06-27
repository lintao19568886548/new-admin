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
    const body = await readBody(event);
    const { user, parkId, startDate, endDate, reason, username } = body;

    if (!user || !parkId || !startDate || !endDate || !reason) {
      return serverErrorResponse('缺少必要的表单字段', event);
    }

    // 根据parkId获取园区名称
    const park = await prismaClient.park.findUnique({
      where: { parkId: Number(parkId) },
      select: { parkName: true },
    });

    const newApplication = await prismaClient.leaveApplication.create({
      data: {
        user,
        park: park?.parkName || `园区${parkId}`,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        username,
        status: 0, // 默认状态, 0-待审核
      },
    });

    return useResponseSuccess(newApplication);
  } catch (error) {
    console.error('创建请假申请失败:', error);
    return serverErrorResponse('创建请假申请失败', event);
  }
});

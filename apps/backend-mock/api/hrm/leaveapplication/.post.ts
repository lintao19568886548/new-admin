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
    const { user, parkId, startDate, endDate, reason } = body;

    if (!user || !parkId || !startDate || !endDate || !reason) {
      return serverErrorResponse('缺少必要的表单字段', event);
    }

    const applicant = await prismaClient.user.findFirst({
      where: {
        realName: user,
      },
    });

    const newApplication = await prismaClient.leaveApplication.create({
      data: {
        ...body,
        userId: applicant?.id,
        auditUser: body.auditUser || null, // 提供默认空字符串
      },
    });

    return useResponseSuccess(newApplication);
  } catch (error) {
    console.error('创建请假申请失败:', error);
    return serverErrorResponse('创建请假申请失败', event);
  }
});

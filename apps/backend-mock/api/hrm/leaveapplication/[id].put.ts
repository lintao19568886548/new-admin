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

  const { id } = getRouterParams(event);
  if (!id || Number.isNaN(Number(id))) {
    return serverErrorResponse('无效的ID', event);
  }

  try {
    const body = await readBody(event);
    const {
      user,
      parkId,
      startDate,
      endDate,
      reason,
      status,
      reply,
      auditUser,
    } = body;

    const updateData: any = {};
    if (user !== undefined) {
      updateData.user = user;
      const applicant = await prismaClient.user.findFirst({
        where: { realName: user },
      });
      if (applicant) {
        updateData.userId = applicant.id;
      }
    }
    if (parkId !== undefined) {
      updateData.parkId = Number(parkId);
      // 根据parkId获取园区名称
      const park = await prismaClient.park.findUnique({
        where: { parkId: Number(parkId) },
        select: { parkName: true },
      });
      updateData.park = park?.parkName;
    }
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;
    if (reason !== undefined) updateData.reason = reason;
    if (status !== undefined) updateData.status = Number(status);
    if (reply !== undefined) updateData.reply = reply;
    if (auditUser !== undefined) {
      updateData.auditUser = auditUser;
      const auditor = await prismaClient.user.findFirst({
        where: { realName: auditUser },
      });
      if (auditor) {
        updateData.auditUserId = auditor.id;
      }
    }
    updateData.username = userinfo.realName;

    if (Object.keys(updateData).length === 0) {
      return serverErrorResponse('没有提供要更新的字段', event);
    }

    const updatedApplication = await prismaClient.leaveApplication.update({
      where: {
        id: Number(id),
      },
      data: updateData,
    });

    return useResponseSuccess(updatedApplication);
  } catch (error) {
    console.error('更新请假申请失败:', error);
    return serverErrorResponse('更新请假申请失败', event);
  }
});

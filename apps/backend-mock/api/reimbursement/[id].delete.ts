import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }

  try {
    const id = Number(event.context.params?.id);
    if (Number.isNaN(id)) {
      return useResponseError('无效的报销ID', 400);
    }

    const reimbursement = await prismaClient.reimbursement.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      select: {
        parkId: true,
        userId: true,
      },
    });
    if (!reimbursement) {
      return useResponseError('未找到报销记录', 404);
    }

    const hasAuditPermission = (userinfo.reimbursementAuth || 0) > 0;
    const isOwnRecord = Number(reimbursement.userId) === Number(userinfo.id);
    const allowedParkIds = (userinfo.parks || [])
      .map((park) => Number(park.parkId))
      .filter((parkId) => !Number.isNaN(parkId));
    const canDeleteByAuditRole =
      hasAuditPermission &&
      allowedParkIds.includes(Number(reimbursement.parkId));
    if (!isOwnRecord && !canDeleteByAuditRole) {
      return forbiddenResponse(event, '无删除该报销记录权限');
    }

    // 删除报销记录
    const deletedReimbursement = await prismaClient.reimbursement.update({
      where: { id },
      data: {
        isDeleted: true,
      },
    });

    console.log('删除报销记录成功:', deletedReimbursement);
    return useResponseSuccess(deletedReimbursement);
  } catch (error) {
    console.error('删除报销记录失败:', error);
    return useResponseError('删除报销记录失败', 500);
  }
});

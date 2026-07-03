import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { syncApprovedReimbursementFinanceRecord } from '~/utils/reimbursement-finance';
import {
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';
import {
  fetchUserWithDetails,
  transformPrismaUserToUserInfo,
} from '~/utils/user-service';

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

    const currentUser = await fetchUserWithDetails(
      userinfo.username,
      prismaClient,
    );
    if (!currentUser || Number(currentUser.status ?? 1) !== 1) {
      return unAuthorizedResponse(event);
    }

    const currentUserinfo = await transformPrismaUserToUserInfo(
      currentUser,
      prismaClient,
    );

    const hasAuditPermission = (currentUserinfo.reimbursementAuth || 0) > 0;
    if (!hasAuditPermission) {
      return forbiddenResponse(event, '无报销审核权限');
    }

    // 获取请求体数据
    const body = await readBody(event);

    // 仅允许通过或拒绝
    if (body.status === undefined || ![1, 2].includes(Number(body.status))) {
      return useResponseError('审核状态无效', 400);
    }

    const reimbursement = await prismaClient.reimbursement.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      select: {
        amount: true,
        parkId: true,
        status: true,
      },
    });

    if (!reimbursement) {
      return useResponseError('未找到报销记录', 404);
    }

    if (reimbursement.status !== 0) {
      return useResponseError('该报销记录已审核，无法重复操作', 400);
    }

    const allowedParkIds = (currentUserinfo.parks || [])
      .map((park) => Number(park.parkId))
      .filter((parkId) => !Number.isNaN(parkId));
    if (!allowedParkIds.includes(Number(reimbursement.parkId))) {
      return forbiddenResponse(event, '无该园区审核权限');
    }

    const rates = currentUserinfo.rates;
    const hasUnlimitedRates =
      rates === null || rates === undefined || Number(rates) < 0;
    if (!hasUnlimitedRates && Number(reimbursement.amount) > Number(rates)) {
      return forbiddenResponse(event, '金额超出审核权限');
    }

    // 构造审核意见前缀
    const opinionPrefix = `审核人：${currentUserinfo.realName}\n`;
    const finalOpinion = body.auditOpinion
      ? opinionPrefix + body.auditOpinion
      : opinionPrefix;

    const updatedReimbursement = await prismaClient.$transaction(async (tx) => {
      // 更新报销记录
      const result = await tx.reimbursement.update({
        where: { id },
        data: {
          status: body.status === undefined ? undefined : Number(body.status),
          auditOpinion: finalOpinion,
          // 根据需要，可以添加其他审核相关字段的更新
          // auditor: body.auditor,
          // auditorId: body.auditorId,
        },
        include: {
          images: {
            include: {
              image: true, // 包含关联的图片详情
            },
          },
        },
      });

      // 如果报销已通过，则同步到财务记录
      if (result.status === 1) {
        await syncApprovedReimbursementFinanceRecord(tx, result);
      }

      return result;
    });

    console.log('更新报销状态成功:', updatedReimbursement);
    return useResponseSuccess(updatedReimbursement);
  } catch (error) {
    console.error('更新报销状态失败:', error);
    return serverErrorResponse('更新报销状态失败', event);
  }
});

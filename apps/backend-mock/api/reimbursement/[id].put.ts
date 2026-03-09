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

    const hasAuditPermission = (userinfo.reimbursementAuth || 0) > 0;
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

    const allowedParkIds = (userinfo.parks || [])
      .map((park) => Number(park.parkId))
      .filter((parkId) => !Number.isNaN(parkId));
    if (!allowedParkIds.includes(Number(reimbursement.parkId))) {
      return forbiddenResponse(event, '无该园区审核权限');
    }

    const rates = userinfo.rates;
    const hasUnlimitedRates =
      rates === null || rates === undefined || Number(rates) < 0;
    if (!hasUnlimitedRates && Number(reimbursement.amount) > Number(rates)) {
      return forbiddenResponse(event, '金额超出审核权限');
    }

    // 构造审核意见前缀
    const opinionPrefix = `审核人：${userinfo.realName}\n`;
    const finalOpinion = body.auditOpinion
      ? opinionPrefix + body.auditOpinion
      : opinionPrefix;

    // 更新报销记录
    const updatedReimbursement = await prismaClient.reimbursement.update({
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
    if (updatedReimbursement.status === 1) {
      await prismaClient.finance.create({
        data: {
          billName: updatedReimbursement.purpose,
          billCategory: '其他费用',
          amount: updatedReimbursement.amount,
          transactionType: '支出',
          transactionTime: updatedReimbursement.createTime || new Date(),
          remark: `报销 #${updatedReimbursement.id}`,
          parkId: updatedReimbursement.parkId,
          // 添加图片信息
          images: {
            create: updatedReimbursement.images
              .map((reimbursementImage) => ({
                url: reimbursementImage.image?.imgUrl || '',
              }))
              .filter((img) => img.url), // 过滤掉无效的图片
          },
        },
      });
      console.log(`报销 #${updatedReimbursement.id} 已通过，同步到财务记录。`);
    }

    console.log('更新报销状态成功:', updatedReimbursement);
    return useResponseSuccess(updatedReimbursement);
  } catch (error) {
    console.error('更新报销状态失败:', error);
    return useResponseError('更新报销状态失败', 500);
  }
});

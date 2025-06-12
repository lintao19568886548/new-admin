import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
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

    // 获取请求体数据
    const body = await readBody(event);

    // 验证状态值
    if (
      body.status !== undefined &&
      ![0, 1, 2, 3, 4].includes(Number(body.status))
    ) {
      return useResponseError('无效的状态值', 400);
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

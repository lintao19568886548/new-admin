import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const financeId = Number.parseInt(event.context.params.id);
  if (!financeId) {
    return useResponseError('financeId错误');
  }

  try {
    // 确保日期字段格式正确
    const transactionTime = body.transactionTime
      ? new Date(body.transactionTime)
      : undefined;

    const finance = await prismaClient.finance.update({
      where: {
        financeId,
      },
      data: {
        billName: body.billName,
        billCategory: body.billCategory,
        amount: Number.parseFloat(body.amount),
        transactionType: body.transactionType,
        transactionTime,
        remark: body.remark || null,
        updateTime: new Date(),
      },
    });
    return useResponseSuccess(finance);
  } catch (error) {
    console.error('更新财务数据失败:', error);
    return useResponseError('更新财务数据失败', 500);
  }
});

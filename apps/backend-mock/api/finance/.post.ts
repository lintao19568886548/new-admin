import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  console.log('请求体参数:', body);

  try {
    // 确保日期字段格式正确
    const transactionTime = body.transactionTime
      ? new Date(body.transactionTime)
      : new Date();

    // 创建财务记录
    const finance = await prismaClient.finance.create({
      data: {
        billName: body.billName,
        billCategory: body.billCategory,
        amount: Number.parseFloat(body.amount),
        transactionType: body.transactionType,
        transactionTime,
        remark: body.remark || null,
        // 自动添加创建和更新时间
        createTime: new Date(),
        updateTime: new Date(),
      },
    });

    console.log('插入财务数据成功:', finance);
    return useResponseSuccess(finance);
  } catch (error) {
    console.error('插入财务数据失败:', error);
    return useResponseError('插入财务数据失败', 500);
  }
});

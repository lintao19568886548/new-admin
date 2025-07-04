import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // 获取当前日期信息
  const now = new Date();
  const currentYear = now.getFullYear();

  // 计算当年的开始和结束日期
  const startDate = new Date(currentYear, 0, 1);
  const endDate = new Date(currentYear, 11, 31, 23, 59, 59);

  // 1. 获取支出数据 (来自 Finance)
  const expenseTrend = await prismaClient.finance.groupBy({
    by: ['billCategory'],
    _sum: {
      amount: true,
    },
    where: {
      transactionType: '支出',
      transactionTime: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const expenseData = expenseTrend.map((item) => ({
    name: item.billCategory,
    value: item._sum.amount || 0,
  }));

  // 2. 获取收入数据 (来自 AmountBill)
  const incomeAggregation = await prismaClient.amountBill.aggregate({
    _sum: {
      eleFee: true,
      waterFee: true,
      factoryRent: true,
      managementFee: true,
      serviceFee: true,
      garbageFee: true,
      penaltyFee: true,
      receiveFee: true, // 其他收入
    },
    where: {
      createTime: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const incomeSums = incomeAggregation._sum;

  const incomeData = [
    { name: '电费', value: Number(incomeSums.eleFee) || 0 },
    { name: '水费', value: Number(incomeSums.waterFee) || 0 },
    { name: '厂房租金', value: Number(incomeSums.factoryRent) || 0 },
    { name: '管理费', value: Number(incomeSums.managementFee) || 0 },
    { name: '服务费', value: Number(incomeSums.serviceFee) || 0 },
    { name: '垃圾费', value: Number(incomeSums.garbageFee) || 0 },
    { name: '滞纳金', value: Number(incomeSums.penaltyFee) || 0 },
    { name: '其他收入', value: Number(incomeSums.receiveFee) || 0 },
  ].filter((item) => item.value > 0); // 过滤掉值为0的项

  return useResponseSuccess({
    income: incomeData,
    expense: expenseData,
  });
});

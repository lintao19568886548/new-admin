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
  const currentMonth = now.getMonth(); // 0-11

  // === 当月数据 ===
  const currentMonthStartDate = new Date(currentYear, currentMonth, 1);
  const currentMonthEndDate = new Date(currentYear, currentMonth + 1, 0);

  // 1. 获取当月支出 (来自 Finance)
  const currentMonthExpense = await prismaClient.finance.aggregate({
    _sum: { amount: true },
    where: {
      transactionType: '支出',
      transactionTime: {
        gte: currentMonthStartDate,
        lte: currentMonthEndDate,
      },
    },
  });

  // 2. 获取当月收入 (来自 AmountBill)
  const currentMonthIncome = await prismaClient.amountBill.aggregate({
    _sum: { totalFee: true },
    where: {
      createTime: {
        gte: currentMonthStartDate,
        lte: currentMonthEndDate,
      },
    },
  });

  // === 上月数据 ===
  const lastMonthDate = new Date(now.setMonth(now.getMonth() - 1));
  const lastMonthYear = lastMonthDate.getFullYear();
  const lastMonth = lastMonthDate.getMonth(); // 0-11

  const lastMonthStartDate = new Date(lastMonthYear, lastMonth, 1);
  const lastMonthEndDate = new Date(lastMonthYear, lastMonth + 1, 0);

  // 3. 获取上月支出 (来自 Finance)
  const lastMonthExpense = await prismaClient.finance.aggregate({
    _sum: { amount: true },
    where: {
      transactionType: '支出',
      transactionTime: {
        gte: lastMonthStartDate,
        lte: lastMonthEndDate,
      },
    },
  });

  // 4. 获取上月收入 (来自 AmountBill)
  const lastMonthIncome = await prismaClient.amountBill.aggregate({
    _sum: { totalFee: true },
    where: {
      createTime: {
        gte: lastMonthStartDate,
        lte: lastMonthEndDate,
      },
    },
  });

  // 构建结果对象
  const result = {
    currentMonth: {
      income: {
        name: '本月收入',
        value: currentMonthIncome._sum.totalFee || 0,
      },
      expense: {
        name: '本月支出',
        value: currentMonthExpense._sum.amount || 0,
      },
    },
    lastMonth: {
      income: {
        name: '上月收入',
        value: lastMonthIncome._sum.totalFee || 0,
      },
      expense: {
        name: '上月支出',
        value: lastMonthExpense._sum.amount || 0,
      },
    },
  };

  return useResponseSuccess(result);
});

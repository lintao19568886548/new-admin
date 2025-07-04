import { prismaClient } from '~/utils/db';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const query = getQuery(event);

  const type = query.type?.toString() || 'days'; // 默认为按天统计

  // 获取当前日期
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  if (type === 'days') {
    // 按天统计 - 查询当月数据
    const startDate = new Date(currentYear, currentMonth, 1);
    const endDate = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = endDate.getDate();

    // 1. 获取支出数据 (来自 Finance)
    const expenseItems = await prismaClient.finance.findMany({
      where: {
        transactionTime: {
          gte: startDate,
          lte: endDate,
        },
        transactionType: '支出',
      },
      select: {
        transactionTime: true,
        amount: true,
      },
    });

    const expenseData = Array.from({ length: daysInMonth }, () => 0);
    for (const item of expenseItems) {
      const day = new Date(item.transactionTime).getDate() - 1;
      expenseData[day] += Number(item.amount);
    }

    // 2. 获取收入数据 (来自 AmountBill)
    const incomeItems = await prismaClient.amountBill.findMany({
      where: {
        createTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createTime: true,
        totalFee: true,
      },
    });

    const incomeData = Array.from({ length: daysInMonth }, () => 0);
    for (const item of incomeItems) {
      if (item.createTime) {
        const day = new Date(item.createTime).getDate() - 1;
        incomeData[day] += Number(item.totalFee);
      }
    }

    return useResponseSuccess({
      incomeData,
      expenseData,
      daysInMonth,
      year: currentYear,
      month: currentMonth + 1,
      type: 'days',
    });
  } else if (type === 'months') {
    // 按月统计 - 查询当年数据
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31, 23, 59, 59);

    // 1. 获取支出数据 (来自 Finance)
    const expenseItems = await prismaClient.finance.findMany({
      where: {
        transactionTime: {
          gte: startDate,
          lte: endDate,
        },
        transactionType: '支出',
      },
      select: {
        transactionTime: true,
        amount: true,
      },
    });

    const expenseDatamonths = Array.from({ length: 12 }, () => 0);
    for (const item of expenseItems) {
      const month = new Date(item.transactionTime).getMonth();
      expenseDatamonths[month] += Number(item.amount);
    }

    // 2. 获取收入数据 (来自 AmountBill)
    const incomeItems = await prismaClient.amountBill.findMany({
      where: {
        createTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createTime: true,
        totalFee: true,
      },
    });

    const incomeDatamonths = Array.from({ length: 12 }, () => 0);
    for (const item of incomeItems) {
      if (item.createTime) {
        const month = new Date(item.createTime).getMonth();
        incomeDatamonths[month] += Number(item.totalFee);
      }
    }

    return useResponseSuccess({
      incomeDatamonths,
      expenseDatamonths,
      monthLabels: Array.from({ length: 12 }, (_, i) => `${i + 1}月`),
      monthsInYear: 12,
      year: currentYear,
      type: 'months',
    });
  } else {
    return useResponseError('不支持的统计类型');
  }
});

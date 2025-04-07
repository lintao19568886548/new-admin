import { prismaClient } from '~/utils/db';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const query = getQuery(event);

  const type = query.type?.toString() || 'days'; // 默认为按天统计

  // 获取当前日期
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // JavaScript月份从0开始，所以要加1

  // 构建查询条件
  const where: any = {};

  if (type === 'days') {
    // 按天统计 - 查询当月数据
    // 计算当月的起始日期和结束日期
    const startDate = new Date(currentYear, currentMonth - 1, 1); // 月份从0开始，所以要减1
    const endDate = new Date(currentYear, currentMonth, 0); // 下个月的第0天就是当前月的最后一天
    const daysInMonth = endDate.getDate(); // 获取当月天数

    where.transactionTime = {
      gte: startDate,
      lte: endDate,
    };

    console.log(
      `查询当前月份(${currentYear}年${currentMonth}月)的数据，日期范围:`,
      startDate,
      '至',
      endDate,
    );

    // 查询当月所有财务数据
    const items = await prismaClient.finance.findMany({
      where,
      select: {
        transactionTime: true,
        amount: true,
        transactionType: true,
      },
    });

    // 初始化收入和支出数组，长度为当月天数
    const incomeData = Array.from({ length: daysInMonth }).fill(0) as number[];
    const expenseData = Array.from({ length: daysInMonth }).fill(0) as number[];

    // 遍历所有财务数据，按日期累加收入和支出
    for (const item of items) {
      const day = new Date(item.transactionTime).getDate() - 1; // 获取日期（1-31），转为数组索引（0-30）
      const amount = Number(item.amount);

      // 根据类型累加到对应数组
      if (item.transactionType === '收入') {
        incomeData[day] += amount;
      } else if (item.transactionType === '支出') {
        expenseData[day] += amount;
      }
    }

    return useResponseSuccess({
      incomeData, // 收入数组
      expenseData, // 支出数组
      daysInMonth, // 当月天数
      year: currentYear,
      month: currentMonth,
      type: 'days',
    });
  } else if (type === 'months') {
    // 按月统计 - 查询当年数据
    // 计算当年的起始日期和结束日期
    const startDate = new Date(currentYear, 0, 1); // 当年1月1日
    const endDate = new Date(currentYear, 11, 31, 23, 59, 59); // 当年12月31日

    where.transactionTime = {
      gte: startDate,
      lte: endDate,
    };

    console.log(
      `查询当年(${currentYear}年)的数据，日期范围:`,
      startDate,
      '至',
      endDate,
    );

    // 查询当年所有财务数据
    const items = await prismaClient.finance.findMany({
      where,
      select: {
        transactionTime: true,
        amount: true,
        transactionType: true,
      },
    });

    // 初始化收入和支出数组，长度为12个月
    const incomeData = Array.from({ length: 12 }).fill(0) as number[];
    const expenseData = Array.from({ length: 12 }).fill(0) as number[];

    // 遍历所有财务数据，按月份累加收入和支出
    for (const item of items) {
      const month = new Date(item.transactionTime).getMonth(); // 获取月份（0-11）
      const amount = Number(item.amount);

      // 根据类型累加到对应数组
      if (item.transactionType === '收入') {
        incomeData[month] += amount;
      } else if (item.transactionType === '支出') {
        expenseData[month] += amount;
      }
    }

    return useResponseSuccess({
      incomeData, // 收入数组（按月）
      expenseData, // 支出数组（按月）
      monthsInYear: 12, // 一年12个月
      year: currentYear,
      type: 'months',
    });
  } else {
    return useResponseError('不支持的统计类型');
  }
});

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
  const currentMonth = now.getMonth() + 1; // JavaScript月份从0开始

  // 计算当月的开始和结束日期
  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0); // 当月最后一天

  // 使用Prisma查询当月数据并按billCategory分组
  const currentMonthData = await prismaClient.finance.groupBy({
    by: ['transactionType'], // 添加transactionType作为分组条件
    _sum: {
      amount: true,
    },
    where: {
      transactionTime: {
        gte: startDate,
        lte: endDate,
      },
    },
  });
  // 计算上个月的开始和结束日期
  const lastMonth = currentMonth - 1;
  const lastStartDate = new Date(currentYear, lastMonth - 1, 1);
  const lastEndDate = new Date(currentYear, lastMonth, 0); // 上个月最后一天
  // 使用Prisma查询上个月数据并按billCategory分组
  const lastMonthData = await prismaClient.finance.groupBy({
    by: ['transactionType'], // 添加transactionType作为分组条件
    _sum: {
      amount: true,
    },
    where: {
      transactionTime: {
        gte: lastStartDate,
        lte: lastEndDate,
      },
    },
  });

  const currentMonthMap = {};
  const lastMonthMap = {};

  currentMonthData.forEach((item) => {
    currentMonthMap[item.transactionType] = item._sum.amount || 0;
  });

  lastMonthData.forEach((item) => {
    lastMonthMap[item.transactionType] = item._sum.amount || 0;
  });

  // 构建结果对象
  const result = {
    currentMonth: {
      income: {
        name: '本月收入',
        value: currentMonthMap['收入'] || 0,
      },
      expense: {
        name: '本月支出',
        value: currentMonthMap['支出'] || 0,
      },
    },
    lastMonth: {
      income: {
        name: '上月收入',
        value: lastMonthMap['收入'] || 0,
      },

      expense: {
        name: '上月支出',
        value: lastMonthMap['支出'] || 0,
      },
    },
  };

  return useResponseSuccess(result);
});

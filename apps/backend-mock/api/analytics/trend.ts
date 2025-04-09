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
  const trend = await prismaClient.finance.groupBy({
    by: ['billCategory', 'transactionType'], // 添加transactionType作为分组条件
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

  // 按照transactionType分类数据
  const incomeData = trend.filter((item) => item.transactionType === '收入');
  const expenseData = trend.filter((item) => item.transactionType === '支出');

  // 构建结果对象
  const result = {
    income: incomeData.map((item) => ({
      name: item.billCategory,
      value: item._sum.amount || 0,
    })),
    expense: expenseData.map((item) => ({
      name: item.billCategory,
      value: item._sum.amount || 0,
    })),
  };

  return useResponseSuccess(result);
});

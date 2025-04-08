import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }

  // 获取当前日期信息
  const now = new Date();
  const currentYear = now.getFullYear();

  // 计算当年的开始和结束日期
  const startDate = new Date(currentYear, 0, 1); // 当年1月1日
  const endDate = new Date(currentYear, 11, 31); // 当年12月31日

  // 使用Prisma查询当年数据并按billCategory分组
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

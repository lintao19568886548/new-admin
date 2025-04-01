import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event);
    console.log('后端收到的查询参数:', query);

    // 构建查询条件
    const where: any = {};

    // 账单名称模糊查询
    if (query.billName) {
      where.billName = {
        contains: String(query.billName),
      };
    }

    // 账单类别精确匹配
    if (query.billCategory) {
      where.billCategory = String(query.billCategory);
    }

    // 交易类型精确匹配
    if (query.transactionType) {
      where.transactionType = String(query.transactionType);
    }

    // 金额范围查询
    if (query.amount) {
      where.amount = Number(query.amount);
    }

    // 日期范围查询
    if (query.startTime && query.endTime) {
      where.transactionTime = {
        gte: new Date(query.startTime as string),
        lte: new Date(query.endTime as string),
      };
    }

    // 区域查询
    if (query.area && query.area !== 'all') {
      where.area = String(query.area);
    }

    console.log('构建的查询条件:', where);

    // 执行查询
    const financeList = await prismaClient.finance.findMany({
      where,
      orderBy: {
        transactionTime: 'desc',
      },
    });

    console.log(`查询到 ${financeList.length} 条记录`);
    return useResponseSuccess(financeList);
  } catch (error) {
    console.error('查询财务数据失败:', error);
    return useResponseError('查询财务数据失败', 500);
  }
});

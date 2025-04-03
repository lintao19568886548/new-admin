import { prismaClient } from '~/utils/db';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }

  // 获取查询参数
  const query = getQuery(event);
  console.log('query', query);
  const { projectName, tenantName, startTime, endTime, currentPage, pageSize } =
    query;

  // 构建查询条件
  const where: any = {};

  // 项目名称查询
  if (projectName) {
    where.projectName = {
      contains: projectName,
    };
  }

  // 租户名称查询
  if (tenantName) {
    where.tenantName = {
      contains: tenantName,
    };
  }

  // 收款时间范围查询 - 使用startTime和endTime
  if (startTime && endTime) {
    where.receiptTime = {
      gte: new Date(startTime as string),
      lte: new Date(endTime as string),
    };
  }

  // 计算分页参数
  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;

  // 查询总记录数
  const total = await prismaClient.amountBill.count({
    where,
  });

  // 查询分页数据
  const result = await prismaClient.amountBill.findMany({
    where,
    orderBy: {
      receiptTime: 'desc',
    },
    skip: (page - 1) * size,
    take: size,
  });

  return useResponseSuccess({
    items: result,
    total,
  });
});

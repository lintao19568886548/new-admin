import { prismaClient } from '~/utils/db';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // 获取查询参数
  const query = getQuery(event);
  const { startTime, endTime, currentPage, pageSize } = query;

  // 构建查询条件
  const where: any = {};

  // 请求时间范围查询
  if (startTime && endTime) {
    where.requestTime = {
      gte: new Date(startTime as string),
      lte: new Date(endTime as string),
    };
  }

  // 计算分页参数
  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;

  // 查询总记录数
  const total = await prismaClient.apiLog.count({
    where,
  });

  // 查询分页数据
  const items = await prismaClient.apiLog.findMany({
    where,
    orderBy: {
      requestTime: 'desc',
    },
    skip: (page - 1) * size,
    take: size,
  });

  return useResponseSuccess({
    items,
    total,
  });
});

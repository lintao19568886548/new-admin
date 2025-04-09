import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (currentPage - 1) * pageSize;

    // 构建查询条件
    const where: any = {};

    if (query.visitorName) {
      where.visitorName = { contains: query.visitorName };
    }
    if (query.phoneNumber) {
      where.phoneNumber = { contains: query.phoneNumber };
    }
    if (query.carNum) {
      where.carNum = { contains: query.carNum };
    }
    if (query.status !== undefined && query.status !== '') {
      where.status = Number(query.status);
    }
    if (query.registerTime) {
      const [start, end] = (query.registerTime as string).split(',');
      where.registerTime = {
        gte: new Date(`${start} 00:00:00`),
        lte: new Date(`${end} 23:59:59`),
      };
    }

    // 获取总数
    const total = await prismaClient.visitor.count({ where });

    // 获取分页数据
    const visitors = await prismaClient.visitor.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createTime: 'desc',
      },
    });

    return useResponseSuccess({
      items: visitors,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('获取访客列表失败:', error);
    return useResponseError('获取访客列表失败', 500);
  }
});

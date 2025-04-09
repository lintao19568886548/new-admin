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

    if (query.tenantName) {
      where.tenantName = { contains: query.tenantName };
    }
    if (query.phoneNumber) {
      where.phoneNumber = { contains: query.phoneNumber };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.contractDate) {
      const [start, end] = (query.contractDate as string).split(',');
      where.contractDate = {
        gte: new Date(`${start} 00:00:00`), // 添加时间部分
        lte: new Date(`${end} 23:59:59`), // 添加时间部分，确保包含整天
      };
    }
    if (query.increaseDate) {
      const [start, end] = (query.increaseDate as string).split(',');
      where.increaseDate = {
        gte: new Date(`${start} 00:00:00`), // 添加时间部分
        lte: new Date(`${end} 23:59:59`), // 添加时间部分，确保包含整天
      };
    }
    if (query.address) {
      where.address = { contains: query.address };
    }

    // 获取总数
    const total = await prismaClient.rentalTenant.count({ where });

    // 获取分页数据
    const tenants = await prismaClient.rentalTenant.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createTime: 'desc',
      },
    });

    return useResponseSuccess({
      items: tenants,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('获取租户列表失败:', error);
    return useResponseError('获取租户列表失败', 500);
  }
});

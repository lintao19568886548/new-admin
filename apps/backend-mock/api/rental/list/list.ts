import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 9; // 默认每页9条记录
    const skip = (currentPage - 1) * pageSize;

    // 构建查询条件
    const where: any = {};

    // 厂房名称查询
    if (query.factoryName) {
      where.factoryName = { contains: query.factoryName };
    }

    // 联系人查询
    if (query.contact) {
      where.contact = { contains: query.contact };
    }

    // 状态查询
    if (query.status) {
      where.status = { equals: query.status };
    }

    // 获取总数
    const total = await prismaClient.factory.count({ where });

    // 获取分页数据
    const factories = await prismaClient.factory.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createTime: 'desc',
      },
    });

    return useResponseSuccess({
      items: factories,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('获取厂房列表失败:', error);
    return useResponseError('获取厂房列表失败', 500);
  }
});

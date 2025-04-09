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

    // 修改查询条件，匹配前端表单字段
    if (query.title) {
      where.title = { contains: query.title };
    }
    if (query.price) {
      where.price = { contains: query.price };
    }
    if (query.area) {
      where.area = { contains: query.area };
    }
    if (query.availableArea) {
      where.availableArea = query.availableArea;
    }
    if (query.address) {
      where.address = { contains: query.address };
    }
    if (query.contact) {
      where.contact = { contains: query.contact };
    }
    if (query.description) {
      where.description = { contains: query.description };
    }

    // 获取总数
    const total = await prismaClient.rentalManage.count({ where });

    // 获取分页数据
    const manages = await prismaClient.rentalManage.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createTime: 'desc',
      },
    });

    return useResponseSuccess({
      items: manages,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('获取租赁管理列表失败:', error);
    return useResponseError('获取租赁管理列表失败', 500);
  }
});

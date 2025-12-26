import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

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

    const requestedParkRaw = query.parkId ?? query.currentPark;
    if (requestedParkRaw !== undefined) {
      const requestedParkId = Number(requestedParkRaw);
      if (requestedParkId === -1) {
        const parks = await prismaClient.park.findMany({
          where: {
            parkId: {
              in: userinfo.parks.map((park) => park.parkId),
            },
          },
          select: { parkId: true },
        });

        if (parks.length > 0) {
          where.parkId = {
            in: parks.map((park) => park.parkId),
          };
        }
      } else if (
        userinfo.parks.map((park) => park.parkId).includes(requestedParkId)
      ) {
        const park = await prismaClient.park.findFirst({
          where: { parkId: requestedParkId },
          select: { parkId: true },
        });

        if (park) {
          where.parkId = park.parkId;
        }
      } else {
        return useResponseError('没有查看权限');
      }
    }

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
    const total = await prismaClient.accessVisitor.count({ where });

    // 获取分页数据
    const visitors = await prismaClient.accessVisitor.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        // 添加 include 来关联 Park 模型
        park: true,
      },
      orderBy: {
        createTime: 'desc',
      },
    });

    // 转换数据，将 park.parkName 映射到 parkName
    const formattedVisitors = visitors.map((visitor) => ({
      ...visitor,
      parkName: visitor.park?.parkName || '未知园区',
    }));

    return useResponseSuccess({
      items: formattedVisitors, // 返回处理后的数据
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('获取访客列表失败:', error);
    return serverErrorResponse(`获取访客列表失败`, event);
  }
});

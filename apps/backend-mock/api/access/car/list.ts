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

    // 区域查询
    if (query.currentPark) {
      if (Number(query.currentPark) === -1) {
        // 选择全部区域时,直接查询全部有权限的园区
        const parks = await prismaClient.park.findMany({
          where: {
            parkName: {
              in: userinfo.parks.map((park) => park.parkName),
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
        userinfo.parks
          .map((park) => park.parkId)
          .includes(Number(query.currentPark))
      ) {
        // 当用户有权限查看特定园区时
        const park = await prismaClient.park.findFirst({
          where: { parkId: Number(query.currentPark) },
          select: { parkId: true },
        });

        if (park) {
          where.parkId = park.parkId;
        }
      } else {
        return useResponseError('没有查看权限');
      }
    }

    // 修改查询条件，匹配前端传递的参数
    if (query.carNumber) {
      where.carNumber = { contains: query.carNumber };
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
    const total = await prismaClient.accessCar.count({ where });

    // 获取分页数据
    const cars = await prismaClient.accessCar.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createTime: 'desc',
      },
    });

    return useResponseSuccess({
      items: cars,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('获取车辆列表失败:', error);
    return useResponseError('获取车辆列表失败', 500);
  }
});

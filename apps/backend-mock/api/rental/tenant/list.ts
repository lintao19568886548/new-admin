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

    // 区域查询
    // if (query.currentPark && Number(query.currentPark) !== -1) {
    //   where.parkId = Number(query.currentPark);
    // }

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
    if (query.increaseRate) {
      where.increaseRate = Number(query.increaseRate);
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

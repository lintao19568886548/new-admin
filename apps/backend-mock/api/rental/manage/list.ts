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

    // 修改查询条件，匹配前端表单字段
    if (query.factoryName) {
      where.factoryName = { contains: query.factoryName };
    }

    // 处理价格查询 - 支持等于和区间查询
    if (query.rentPrice) {
      const priceQuery = String(query.rentPrice).split(',');
      if (priceQuery[0] === 'equal' && priceQuery[1]) {
        const value = Number.parseFloat(priceQuery[1]);
        if (!Number.isNaN(value)) {
          where.rentPrice = { equals: value };
        }
      } else if (
        priceQuery[0] === 'between' &&
        priceQuery[1] &&
        priceQuery[2]
      ) {
        const min = Number.parseFloat(priceQuery[1]);
        const max = Number.parseFloat(priceQuery[2]);
        if (!Number.isNaN(min) && !Number.isNaN(max)) {
          where.rentPrice = {
            gte: min, // 大于等于最小值
            lte: max, // 小于等于最大值
          };
        }
      }
    }

    // 处理总面积查询 - 支持等于和区间查询
    if (query.area) {
      const areaQuery = String(query.area).split(',');
      if (areaQuery[0] === 'equal' && areaQuery[1]) {
        const value = Number.parseFloat(areaQuery[1]);
        if (!Number.isNaN(value)) {
          where.area = { equals: value };
        }
      } else if (areaQuery[0] === 'between' && areaQuery[1] && areaQuery[2]) {
        const min = Number.parseFloat(areaQuery[1]);
        const max = Number.parseFloat(areaQuery[2]);
        if (!Number.isNaN(min) && !Number.isNaN(max)) {
          where.area = {
            gte: min, // 大于等于最小值
            lte: max, // 小于等于最大值
          };
        }
      }
    }

    // 处理空闲面积查询 - 支持等于和区间查询
    if (query.availableArea) {
      const availableAreaQuery = String(query.availableArea).split(',');
      if (availableAreaQuery[0] === 'equal' && availableAreaQuery[1]) {
        const value = Number.parseFloat(availableAreaQuery[1]);
        if (!Number.isNaN(value)) {
          where.availableArea = { equals: value };
        }
      } else if (
        availableAreaQuery[0] === 'between' &&
        availableAreaQuery[1] &&
        availableAreaQuery[2]
      ) {
        const min = Number.parseFloat(availableAreaQuery[1]);
        const max = Number.parseFloat(availableAreaQuery[2]);
        if (!Number.isNaN(min) && !Number.isNaN(max)) {
          where.availableArea = {
            gte: min, // 大于等于最小值
            lte: max, // 小于等于最大值
          };
        }
      }
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
    return serverErrorResponse(`获取厂房列表失败\n${error}`, event);
  }
});

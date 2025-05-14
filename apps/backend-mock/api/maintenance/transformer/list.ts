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
  const {
    transformerName,
    address,
    checker,
    status,
    specifications,
    startTime,
    endTime,
    currentPark,
    currentPage,
    pageSize,
  } = query;

  // 构建查询条件
  const where: any = {};

  // 标题查询
  if (transformerName) {
    where.transformerName = {
      contains: transformerName,
    };
  }

  // 区域查询
  if (currentPark) {
    if (Number(currentPark) === -1) {
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
      userinfo.parks.map((park) => park.parkId).includes(Number(currentPark))
    ) {
      // 当用户有权限查看特定园区时
      const park = await prismaClient.park.findFirst({
        where: { parkId: Number(currentPark) },
        select: { parkId: true },
      });

      if (park) {
        where.parkId = park.parkId;
      }
    } else {
      return useResponseError('没有查看权限');
    }
  }

  // 地址查询
  if (address) {
    where.address = {
      contains: address,
    };
  }

  // 检查人查询
  if (checker) {
    where.checker = {
      contains: checker,
    };
  }

  // 状态查询
  if (status) {
    where.status = {
      equals: status,
    };
  }

  // 规格查询
  if (specifications) {
    where.specifications = {
      contains: specifications,
    };
  }

  // 时间范围查询 - 使用startTime和endTime
  if (startTime && endTime) {
    where.checkTime = {
      gte: new Date(startTime as string),
      lte: new Date(endTime as string),
    };
  }

  // 计算分页参数
  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;

  // 查询总记录数
  const total = await prismaClient.transformer.count({
    where,
  });

  // 查询分页数据
  const result = await prismaClient.transformer.findMany({
    where,
    orderBy: {
      checkTime: 'desc',
    },
    include: {
      factory: {
        select: {
          factoryName: true,
        },
      },
      park: {
        select: {
          parkName: true,
        },
      },
    },
    skip: (page - 1) * size,
    take: size,
    // 只选择需要的字段，减少数据传输量
  });

  const items = result.map((item) => {
    return {
      ...item,
      factoryName: item.factory?.factoryName || '',
      park: item.park?.parkName || '',
    };
  });

  return useResponseSuccess({
    items,
    total,
  });
});

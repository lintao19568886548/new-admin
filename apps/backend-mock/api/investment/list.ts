import { prismaClient } from '~/utils/db';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // 获取查询参数
  const query = getQuery(event);
  const {
    agentName,
    tenantName,
    intentLevel,
    // minIntentArea, // 移除旧参数
    // maxIntentArea, // 移除旧参数
    intentArea, // 新增参数
    progress,
    startTime,
    endTime,
    currentPark,
    currentPage,
    pageSize,
  } = query;

  // 构建查询条件
  const where: any = {};

  // 区域查询
  if (currentPark) {
    if (Number(currentPark) === -1) {
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

  // 中介人名称查询
  if (agentName) {
    where.agentName = {
      contains: agentName,
    };
  }

  // 租户名称查询
  if (tenantName) {
    where.tenantName = {
      contains: tenantName,
    };
  }

  // 意向级别查询
  if (intentLevel) {
    where.intentLevel = {
      equals: intentLevel,
    };
  }

  // 意向面积查询 - 支持等于和区间查询
  if (intentArea) {
    const areaQuery = String(intentArea).split(',');
    if (areaQuery[0] === 'equal' && areaQuery[1]) {
      const value = Number.parseFloat(areaQuery[1]);
      if (!Number.isNaN(value)) {
        where.intentArea = { equals: value };
      }
    } else if (areaQuery[0] === 'between' && areaQuery[1] && areaQuery[2]) {
      const min = Number.parseFloat(areaQuery[1]);
      const max = Number.parseFloat(areaQuery[2]);
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        where.intentArea = {
          gte: min, // 大于等于最小值
          lte: max, // 小于等于最大值
        };
      }
    }
  }

  // 进度查询
  if (progress) {
    where.progress = {
      contains: progress,
    };
  }

  // 时间范围查询 - 使用startTime和endTime
  if (startTime && endTime) {
    where.meetingTime = {
      gte: new Date(startTime as string),
      lte: new Date(endTime as string),
    };
  }

  // 计算分页参数
  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;

  // 查询总记录数
  const total = await prismaClient.investment.count({
    where,
  });

  // 查询分页数据
  const result = await prismaClient.investment.findMany({
    where,
    include: {
      images: {
        include: {
          image: true,
        },
      },
    },
    orderBy: {
      meetingTime: 'desc',
    },
    skip: (page - 1) * size,
    take: size,
    // 只选择需要的字段，减少数据传输量
  });

  // 处理每个投资项目，直接将images替换为imgUrl数组
  const items = result.map((item) => {
    // 提取当前项目的所有图片URL
    const imageUrls = item.images.map((img) => img.image.imgUrl);
    // 返回处理后的项目，将images替换为图片URL数组，并改名为imageUrlList
    return {
      ...item,
      imageUrlList: imageUrls,
      images: undefined, // 移除原始images字段
    };
  });

  return useResponseSuccess({
    items,
    total,
  });
});

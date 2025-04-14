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
    minIntentArea,
    maxIntentArea,
    progress,
    startTime,
    endTime,
    currentPage,
    pageSize,
    area,
  } = query;

  // 构建查询条件
  const where: any = {};
  if (area) {
    const areaStr = String(area);
    if (areaStr === 'all') {
      // 当选择"all"时，直接查询所有有权限的园区
      const parks = await prismaClient.park.findMany({
        where: {
          parkName: {
            in: userinfo.parks,
          },
        },
        select: { parkId: true },
      });

      if (parks.length > 0) {
        where.parkId = {
          in: parks.map((park) => park.parkId),
        };
      }
    } else if (userinfo.parks.includes(areaStr)) {
      // 当用户有权限查看特定园区时
      const park = await prismaClient.park.findFirst({
        where: { parkName: areaStr },
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

  // 意向面积查询
  if (minIntentArea) {
    where.intentArea = {
      gte: Number(minIntentArea),
    };
  }

  if (maxIntentArea) {
    where.intentArea = {
      ...where.intentArea,
      lte: Number(maxIntentArea),
    };
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
  const items = await prismaClient.investment.findMany({
    where,
    orderBy: {
      meetingTime: 'desc',
    },
    skip: (page - 1) * size,
    take: size,
    // 只选择需要的字段，减少数据传输量
    select: {
      investmentId: true,
      agentName: true,
      tenantName: true,
      intentLevel: true,
      intentArea: true,
      progress: true,
      phoneNumber: true,
      meetingTime: true,
      parkId: true,
      remark: true,
    },
  });

  return useResponseSuccess({
    items,
    total,
  });
});

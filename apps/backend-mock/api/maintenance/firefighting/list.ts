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
  } = query;

  // 构建查询条件
  const where: any = {};

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
  const total = await prismaClient.firefighting.count({
    where,
  });

  // 查询分页数据
  const result = await prismaClient.firefighting.findMany({
    where,
    orderBy: {
      maintenanceTime: 'desc',
    },
    skip: (page - 1) * size,
    take: size,
    // 只选择需要的字段，减少数据传输量
  });

  return useResponseSuccess({
    items: result,
    total,
  });
});

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
    contact,
    status,
    specifications,
    startTime,
    endTime,
    parkId,
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

  // 地址查询
  if (address) {
    where.address = {
      contains: address,
    };
  }

  // 联系人查询
  if (contact) {
    where.contact = {
      contains: contact,
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

  // 园区ID查询
  if (parkId) {
    where.parkId = Number(parkId);
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
    skip: (page - 1) * size,
    take: size,
    // 只选择需要的字段，减少数据传输量
    select: {
      transformerId: true,
      transformerName: true,
      address: true,
      contact: true,
      status: true,
      specifications: true,
      checkTime: true,
      remark: true,
      createTime: true,
      updateTime: true,
      parkId: true,
    },
  });

  return useResponseSuccess({
    items: result,
    total,
  });
});

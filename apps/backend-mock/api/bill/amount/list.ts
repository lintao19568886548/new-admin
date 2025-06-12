import { prismaClient } from '~/utils/db';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // 获取查询参数
  const query = getQuery(event);
  const {
    projectName,
    tenantName,
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

  // 项目名称查询
  if (projectName) {
    where.projectName = {
      contains: projectName,
    };
  }

  // 租户名称查询
  if (tenantName) {
    where.tenantName = {
      contains: tenantName,
    };
  }

  // 收款时间范围查询 - 使用startTime和endTime
  if (startTime && endTime) {
    where.receiptTime = {
      gte: new Date(startTime as string),
      lte: new Date(endTime as string),
    };
  }

  // 计算分页参数
  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;

  // 查询总记录数
  const total = await prismaClient.amountBill.count({
    where,
  });

  // 查询分页数据
  const result = await prismaClient.amountBill.findMany({
    where,
    orderBy: {
      createTime: 'desc',
    },
    skip: (page - 1) * size,
    take: size,
    include: {
      tenant: {
        select: {
          tenantName: true,
        },
      },
      park: {
        select: {
          parkName: true,
        },
      },
    },
  });

  const items = result.map((item) => {
    return {
      ...item,
      // 使用可选链安全地访问 tenantName
      tenantName: item.tenant?.tenantName || item.tenantName,
      // 对 parkName 也同样处理
      parkName: item.park?.parkName,
    };
  });

  return useResponseSuccess({
    items,
    total,
  });
});

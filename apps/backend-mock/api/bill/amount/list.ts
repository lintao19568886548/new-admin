import { prismaClient } from '~/utils/db';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

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

  const where: any = {};

  if (currentPark) {
    const parkId = Number(currentPark);
    if (parkId !== -1 && Number.isInteger(parkId) && parkId > 0) {
      where.parkId = parkId;
    }
  }

  if (projectName) {
    where.projectName = {
      contains: projectName,
    };
  }

  if (tenantName) {
    where.tenantName = {
      contains: tenantName,
    };
  }

  if (startTime && endTime) {
    where.receiptTime = {
      gte: new Date(startTime as string),
      lte: new Date(endTime as string),
    };
  }

  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;

  const total = await prismaClient.amountBill.count({
    where,
  });

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

  const items = result.map((item) => ({
    ...item,
    tenantName: item.tenant?.tenantName || item.tenantName,
    parkName: item.park?.parkName,
  }));

  return useResponseSuccess({
    items,
    total,
  });
});

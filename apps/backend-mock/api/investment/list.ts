import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);
  const {
    agentName,
    currentPage,
    currentPark,
    endTime,
    intentArea,
    intentLevel,
    pageSize,
    progress,
    startTime,
    tenantName,
  } = query;

  const where: any = {};

  if (currentPark && Number(currentPark) > 0) {
    where.parkId = Number(currentPark);
  }

  if (agentName) {
    where.agentName = {
      contains: agentName,
    };
  }

  if (tenantName) {
    where.tenantName = {
      contains: tenantName,
    };
  }

  if (intentLevel) {
    where.intentLevel = {
      equals: intentLevel,
    };
  }

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
          gte: min,
          lte: max,
        };
      }
    }
  }

  if (progress) {
    where.progress = {
      contains: progress,
    };
  }

  if (startTime && endTime) {
    where.meetingTime = {
      gte: new Date(startTime as string),
      lte: new Date(endTime as string),
    };
  }

  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;

  const { items, total } = await runWithRadarSharedScope(async () => {
    const total = await prismaClient.investment.count({
      where,
    });

    const result = await prismaClient.investment.findMany({
      include: {
        images: {
          include: {
            image: true,
          },
        },
        park: {
          select: {
            parkName: true,
          },
        },
      },
      orderBy: {
        meetingTime: 'desc',
      },
      skip: (page - 1) * size,
      take: size,
      where,
    });

    return {
      items: result.map((item) => {
        const imageUrls = item.images.map((img) => img.image.imgUrl);

        return {
          ...item,
          imageUrlList: imageUrls,
          images: undefined,
          park: undefined,
          parkName: item.park?.parkName,
        };
      }),
      total,
    };
  });

  return useResponseSuccess({
    items,
    total,
  });
});

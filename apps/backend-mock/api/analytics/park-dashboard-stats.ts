import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const selectedParkId = query.parkId ? Number(query.parkId) : undefined;
    const authorizedParkIds = (userinfo.parks || []).map(
      (park: { parkId: number }) => park.parkId,
    );

    if (authorizedParkIds.length === 0) {
      return useResponseSuccess({
        rentalRate: '0.00',
        rentedArea: '0.00',
        rentedCount: 0,
        totalArea: '0.00',
        totalCount: 0,
        vacantArea: '0.00',
        vacantCount: 0,
      });
    }

    const targetParkIds =
      selectedParkId !== undefined && selectedParkId !== -1
        ? [selectedParkId]
        : authorizedParkIds;

    if (
      selectedParkId !== undefined &&
      selectedParkId !== -1 &&
      !authorizedParkIds.includes(selectedParkId)
    ) {
      return useResponseSuccess({
        rentalRate: '0.00',
        rentedArea: '0.00',
        rentedCount: 0,
        totalArea: '0.00',
        totalCount: 0,
        vacantArea: '0.00',
        vacantCount: 0,
      });
    }

    const factories = await prismaClient.factory.findMany({
      include: {
        floors: {
          where: { isDeleted: false },
        },
      },
      where: {
        isDeleted: false,
        isOwn: true,
        parkId: {
          in: targetParkIds,
        },
      },
    });

    let totalArea = 0;
    let rentedArea = 0;
    let vacantArea = 0;
    let rentedCount = 0;
    let vacantCount = 0;
    let totalCount = 0;

    for (const factory of factories) {
      for (const floor of factory.floors) {
        const floorTotalArea = Number(floor.totalArea) || 0;
        const floorUsedArea = Number(floor.usedArea) || 0;

        totalArea += floorTotalArea;
        rentedArea += Math.min(floorUsedArea, floorTotalArea);
        vacantArea += Math.max(floorTotalArea - floorUsedArea, 0);
        totalCount += 1;

        if (floorUsedArea > 0) {
          rentedCount += 1;
        } else {
          vacantCount += 1;
        }
      }
    }

    const rentalRate = totalArea > 0 ? (rentedArea / totalArea) * 100 : 0;

    return useResponseSuccess({
      rentalRate: rentalRate.toFixed(2),
      rentedArea: rentedArea.toFixed(2),
      rentedCount,
      totalArea: totalArea.toFixed(2),
      totalCount,
      vacantArea: vacantArea.toFixed(2),
      vacantCount,
    });
  } catch (error) {
    console.error('获取园区租赁统计数据失败:', error);
    return useResponseSuccess({
      rentalRate: '0.00',
      rentedArea: '0.00',
      rentedCount: 0,
      totalArea: '0.00',
      totalCount: 0,
      vacantArea: '0.00',
      vacantCount: 0,
    });
  }
});

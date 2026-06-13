import { resolveDashboardReferenceDate } from '~/utils/dashboard-date';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

function emptyStats() {
  return {
    invalidTotalAreaCount: 0,
    overusedCount: 0,
    partialCount: 0,
    rentalRate: '0.00',
    rentedArea: '0.00',
    rentedCount: 0,
    totalArea: '0.00',
    totalCount: 0,
    vacantArea: '0.00',
    vacantCount: 0,
  };
}

function resolveParkIds(
  queryParkId: unknown,
  authorizedParkIds: number[],
): null | number[] {
  if (queryParkId === undefined || queryParkId === 'all') {
    return authorizedParkIds;
  }

  const parkId = Number(queryParkId);
  if (!Number.isFinite(parkId) || !authorizedParkIds.includes(parkId)) {
    return null;
  }

  return [parkId];
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const authorizedParkIds =
      userinfo.parks?.map((park) => Number(park.parkId)).filter(Boolean) ?? [];

    if (authorizedParkIds.length === 0) {
      return useResponseSuccess(emptyStats());
    }

    const query = getQuery(event);
    const referenceDate = resolveDashboardReferenceDate(
      query.endDate || query.date,
    );
    const periodEnd = addDays(startOfDay(referenceDate), 1);
    const parkIds = resolveParkIds(query.parkId, authorizedParkIds);
    if (!parkIds) {
      return useResponseSuccess(emptyStats());
    }

    const floors = await prismaClient.factoryFloor.findMany({
      where: {
        createTime: {
          lt: periodEnd,
        },
        isDeleted: false,
        factory: {
          createTime: {
            lt: periodEnd,
          },
          isDeleted: false,
          park: {
            isDeleted: false,
            parkId: {
              in: parkIds,
            },
          },
        },
      },
      select: {
        totalArea: true,
        usedArea: true,
      },
    });

    let totalArea = 0;
    let rentedArea = 0;
    let vacantArea = 0;
    let rentedCount = 0;
    let vacantCount = 0;
    let partialCount = 0;
    let overusedCount = 0;
    let invalidTotalAreaCount = 0;

    for (const floor of floors) {
      const floorTotalArea = Math.max(Number(floor.totalArea) || 0, 0);
      const floorUsedArea = Math.max(Number(floor.usedArea) || 0, 0);
      const floorVacantArea = Math.max(floorTotalArea - floorUsedArea, 0);

      if (floorTotalArea <= 0) {
        invalidTotalAreaCount++;
      }

      totalArea += floorTotalArea;
      rentedArea += floorUsedArea;
      vacantArea += floorVacantArea;

      if (floorVacantArea <= 0) {
        rentedCount++;
      } else {
        vacantCount++;
      }

      if (floorUsedArea > 0 && floorVacantArea > 0) {
        partialCount++;
      }

      if (floorUsedArea > floorTotalArea) {
        overusedCount++;
      }
    }

    const rentalRate = totalArea > 0 ? (rentedArea / totalArea) * 100 : 0;

    return useResponseSuccess({
      invalidTotalAreaCount,
      overusedCount,
      partialCount,
      rentalRate: rentalRate.toFixed(2),
      rentedArea: rentedArea.toFixed(2),
      rentedCount,
      totalArea: totalArea.toFixed(2),
      totalCount: floors.length,
      vacantArea: vacantArea.toFixed(2),
      vacantCount,
    });
  } catch (error) {
    console.error('获取厂房租赁统计数据失败:', error);
    return serverErrorResponse('获取厂房租赁统计数据失败', event);
  }
});

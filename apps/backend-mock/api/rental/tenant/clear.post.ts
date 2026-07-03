import { prismaClient } from '~/utils/db';
import {
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

function parseBooleanQuery(value: unknown) {
  if (value === true || value === false) {
    return value;
  }
  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
  }
  return undefined;
}

function hasSuperRole(userinfo: any) {
  return (
    Array.isArray(userinfo?.roles) &&
    userinfo.roles.some((role: unknown) => String(role) === 'Super')
  );
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  if (!hasSuperRole(userinfo)) {
    return forbiddenResponse(event, '只有超级管理员可以清空合同');
  }

  try {
    const body = (await readBody(event).catch(() => ({}))) || {};
    const query = {
      ...getQuery(event),
      ...(typeof body === 'object' ? body : {}),
    } as Record<string, unknown>;

    const referenceDate = query.date
      ? new Date(String(query.date))
      : new Date();
    const referenceDay = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
    );
    const expiringLimit = new Date(referenceDay);
    expiringLimit.setMonth(expiringLimit.getMonth() + 1);

    const parks = await prismaClient.park.findMany({
      select: { parkId: true },
      where: { isDeleted: false },
    });
    const availableParkIds = parks
      .map((park) => Number(park.parkId))
      .filter((parkId) => Number.isInteger(parkId) && parkId > 0);

    if (availableParkIds.length === 0) {
      return useResponseSuccess({
        clearedCount: 0,
        matchedCount: 0,
        salaryClearedCount: 0,
      });
    }

    const where: any = {
      isDeleted: false,
      parkId: {
        in: availableParkIds,
      },
    };

    if (query.currentPark !== undefined && query.currentPark !== null) {
      const currentPark = Number(query.currentPark);
      if (currentPark === -1) {
        where.parkId = {
          in: availableParkIds,
        };
      } else if (availableParkIds.includes(currentPark)) {
        where.parkId = currentPark;
      } else {
        return forbiddenResponse(event, '没有清空该园区合同的权限');
      }
    }

    if (query.tenantName) {
      where.tenantName = { contains: String(query.tenantName) };
    }
    if (query.phoneNumber) {
      where.phoneNumber = { contains: String(query.phoneNumber) };
    }
    const transactionType = parseBooleanQuery(query.transactionType);
    if (transactionType !== undefined) {
      where.transactionType = transactionType;
    }
    if (query.status) {
      if (query.status === 'active') {
        where.OR = [
          { contractEnd: { gte: referenceDay } },
          { contractEnd: null },
        ];
      } else if (query.status === 'expired') {
        where.contractEnd = {
          lt: referenceDay,
        };
      }
    }
    if (query.contractView === 'expiring') {
      where.contractEnd = {
        gte: referenceDay,
        lte: expiringLimit,
      };
      delete where.OR;
    }
    if (query.contractDate) {
      const [start, end] = String(query.contractDate).split(',');
      where.contractStart = {
        gte: new Date(`${start} 00:00:00`),
        lte: new Date(`${end} 23:59:59`),
      };
    } else if (query.contractStart && query.contractEnd) {
      where.contractStart = {
        gte: new Date(`${String(query.contractStart)} 00:00:00`),
        lte: new Date(`${String(query.contractEnd)} 23:59:59`),
      };
    }
    if (query.increaseDate) {
      const [start, end] = String(query.increaseDate).split(',');
      where.increaseDate = {
        gte: new Date(`${start} 00:00:00`),
        lte: new Date(`${end} 23:59:59`),
      };
    }
    if (query.address) {
      where.address = { contains: String(query.address) };
    }
    if (query.increaseRate) {
      where.increaseRate = Number(query.increaseRate);
    }

    const result = await prismaClient.$transaction(async (tx) => {
      const tenants = await tx.rentalTenant.findMany({
        select: { rentalTenantId: true },
        where,
      });
      const tenantIds = tenants.map((tenant) => tenant.rentalTenantId);

      if (tenantIds.length === 0) {
        return {
          clearedCount: 0,
          matchedCount: 0,
          salaryClearedCount: 0,
        };
      }

      const salaryResult = await tx.salary.updateMany({
        data: { isDeleted: true },
        where: {
          isDeleted: false,
          rentalTenantId: {
            in: tenantIds,
          },
        },
      });
      const tenantResult = await tx.rentalTenant.updateMany({
        data: { isDeleted: true },
        where: {
          isDeleted: false,
          rentalTenantId: {
            in: tenantIds,
          },
        },
      });

      return {
        clearedCount: tenantResult.count,
        matchedCount: tenantIds.length,
        salaryClearedCount: salaryResult.count,
      };
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('清空合同失败:', error);
    return serverErrorResponse('清空合同失败', event);
  }
});

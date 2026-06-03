import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const hasAuditPermission = (userinfo.reimbursementAuth || 0) > 0;
    const allowedParkIds = (userinfo.parks || [])
      .map((park) => Number(park.parkId))
      .filter((parkId) => !Number.isNaN(parkId));

    const where: any = {
      isDeleted: false,
    };

    if (hasAuditPermission) {
      if (allowedParkIds.length === 0) {
        return useResponseSuccess({
          approved: 0,
          pending: 0,
          rejected: 0,
          total: 0,
        });
      }
      where.parkId = {
        in: allowedParkIds,
      };
    } else {
      where.userId = userinfo.id;
    }

    if (query.claimant) {
      where.claimant = String(query.claimant);
    }

    if (query.purpose) {
      where.purpose = { contains: String(query.purpose) };
    }

    if (query.department) {
      where.department = String(query.department);
    }

    if (query.payee) {
      where.payee = { contains: String(query.payee) };
    }

    if (query.startDate) {
      where.date = {
        ...where.date,
        gte: new Date(String(query.startDate)),
      };
    }

    if (query.endDate) {
      where.date = {
        ...where.date,
        lte: new Date(String(query.endDate)),
      };
    }

    if (query.status) {
      where.status = Number(query.status);
    }

    if (query.parkId) {
      const parkId = Number(query.parkId);
      if (Number.isNaN(parkId)) {
        return useResponseError('园区参数无效', 400);
      }
      if (hasAuditPermission && !allowedParkIds.includes(parkId)) {
        return useResponseSuccess({
          approved: 0,
          pending: 0,
          rejected: 0,
          total: 0,
        });
      }
      where.parkId = parkId;
    }

    const grouped = await prismaClient.reimbursement.groupBy({
      by: ['status'],
      where,
      _count: {
        _all: true,
      },
    });

    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let total = 0;

    for (const item of grouped) {
      const count = item._count._all || 0;
      total += count;

      switch (item.status) {
        case 0: {
          pending = count;

          break;
        }
        case 1: {
          approved = count;

          break;
        }
        case 2: {
          rejected = count;

          break;
        }
        // No default
      }
    }

    return useResponseSuccess({
      approved,
      pending,
      rejected,
      total,
    });
  } catch (error) {
    console.error('查询报销汇总数据失败:', error);
    return useResponseError('查询报销汇总数据失败', 500);
  }
});

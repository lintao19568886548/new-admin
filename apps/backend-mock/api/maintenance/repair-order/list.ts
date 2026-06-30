import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

import { getParkWhereFromQuery } from './utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const parkFilter = getParkWhereFromQuery(userinfo, query);

    if (parkFilter.denied) {
      return useResponseError('没有查看权限');
    }
    if (parkFilter.empty) {
      return useResponseSuccess({ currentPage, items: [], pageSize, total: 0 });
    }

    const where: Record<string, any> = {
      parkId: {
        in: parkFilter.parkIds,
      },
    };

    if (query.factoryId) {
      where.factoryId = Number(query.factoryId);
    }
    if (query.tenantName) {
      where.tenantName = {
        contains: String(query.tenantName).trim(),
      };
    }
    if (query.repairType) {
      where.repairType = String(query.repairType);
    }
    if (query.status) {
      where.status = String(query.status);
    }
    if (query.priority) {
      where.priority = String(query.priority);
    }
    if (query.assignee) {
      where.assignee = {
        contains: String(query.assignee).trim(),
      };
    }
    if (query.orderNo) {
      where.orderNo = {
        contains: String(query.orderNo).trim(),
      };
    }

    if (query.startTime || query.endTime) {
      where.createTime = {};
      if (query.startTime) {
        where.createTime.gte = new Date(String(query.startTime));
      }
      if (query.endTime) {
        where.createTime.lte = new Date(String(query.endTime));
      }
    }

    const total = await prismaClient.repairOrder.count({ where });
    const result = await prismaClient.repairOrder.findMany({
      include: {
        factory: {
          select: {
            factoryName: true,
          },
        },
        park: {
          select: {
            parkName: true,
          },
        },
      },
      orderBy: {
        createTime: 'desc',
      },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      where,
    });

    const items = result.map(({ factory, park, ...item }) => ({
      ...item,
      factory: factory?.factoryName || '',
      park: park?.parkName || '',
    }));

    return useResponseSuccess({
      currentPage,
      items,
      pageSize,
      total,
    });
  } catch (error) {
    console.error('获取报修工单列表失败:', error);
    return serverErrorResponse('获取报修工单列表失败', event);
  }
});

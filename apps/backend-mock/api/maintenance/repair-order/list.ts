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

function getRepairOrderStatusRisk(status?: null | string) {
  const text = String(status || '');
  if (text === '待接单') {
    return 50;
  }
  if (text === '处理中') {
    return 40;
  }
  if (text === '待验收') {
    return 30;
  }
  return 0;
}

function getRepairOrderPriorityRisk(priority?: null | string) {
  const text = String(priority || '');
  if (text.includes('紧急')) {
    return 100;
  }
  if (text.includes('高')) {
    return 60;
  }
  return 0;
}

function getRepairOrderRiskScore(item: {
  priority?: null | string;
  status?: null | string;
}) {
  return (
    getRepairOrderPriorityRisk(item.priority) +
    getRepairOrderStatusRisk(item.status)
  );
}

function compareRepairOrderRisk(first: any, second: any) {
  const riskDiff =
    getRepairOrderRiskScore(second) - getRepairOrderRiskScore(first);
  if (riskDiff !== 0) {
    return riskDiff;
  }

  const firstTime = new Date(first.createTime || 0).getTime();
  const secondTime = new Date(second.createTime || 0).getTime();
  return secondTime - firstTime;
}

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
    if (query.todoView === 'processing') {
      where.status = {
        in: ['待接单', '处理中', '待验收'],
      };
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

    const candidateItems = await prismaClient.repairOrder.findMany({
      select: {
        createTime: true,
        priority: true,
        repairOrderId: true,
        status: true,
      },
      where,
    });

    const sortedCandidates = candidateItems.sort(compareRepairOrderRisk);
    const total = sortedCandidates.length;
    const paginatedIds = sortedCandidates
      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
      .map((item) => item.repairOrderId);
    const detailItems =
      paginatedIds.length === 0
        ? []
        : await prismaClient.repairOrder.findMany({
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
            where: {
              repairOrderId: {
                in: paginatedIds,
              },
            },
          });
    const detailItemMap = new Map(
      detailItems.map((item) => [item.repairOrderId, item]),
    );
    const items = paginatedIds.flatMap((repairOrderId) => {
      const item = detailItemMap.get(repairOrderId);
      if (!item) {
        return [];
      }

      const { factory, park, ...rest } = item;
      return [
        {
          ...rest,
          factory: factory?.factoryName || '',
          park: park?.parkName || '',
        },
      ];
    });

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

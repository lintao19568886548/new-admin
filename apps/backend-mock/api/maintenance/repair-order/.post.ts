import type { Prisma } from '@prisma/.prisma/client/index.js';

import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

import {
  createRepairOrderNo,
  getAuthorizedParkIds,
  normalizeRepairOrderData,
} from './utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const body = await readBody(event);
    const data = normalizeRepairOrderData(body);
    const authorizedParkIds = getAuthorizedParkIds(userinfo);

    if (!data.parkId || !authorizedParkIds.includes(Number(data.parkId))) {
      return useResponseError('没有操作权限');
    }

    const createData: Prisma.RepairOrderUncheckedCreateInput = {
      assignee: data.assignee || null,
      assigneePhone: data.assigneePhone || null,
      description: String(data.description || ''),
      factoryId: data.factoryId || null,
      orderNo: data.orderNo || (await createRepairOrderNo()),
      parkId: Number(data.parkId),
      priority: data.priority || '普通',
      processRemark: data.processRemark || null,
      repairType: String(data.repairType || ''),
      source: data.source || '物业代报修',
      status: data.status || '待接单',
      tenantId: data.tenantId || null,
      tenantName: data.tenantName || null,
      tenantPhone: data.tenantPhone || null,
    };

    const result = await prismaClient.repairOrder.create({
      data: createData,
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('创建报修工单失败:', error);
    return serverErrorResponse('创建报修工单失败', event);
  }
});

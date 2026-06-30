import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

import { getAuthorizedParkIds, normalizeRepairOrderData } from './utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const repairOrderId = Number(event.context.params?.id);
    if (!repairOrderId) {
      return useResponseError('repairOrderId 错误');
    }

    const existed = await prismaClient.repairOrder.findUnique({
      where: {
        repairOrderId,
      },
    });
    if (!existed) {
      return useResponseError('报修工单不存在');
    }

    const authorizedParkIds = getAuthorizedParkIds(userinfo);
    if (!authorizedParkIds.includes(existed.parkId)) {
      return useResponseError('没有操作权限');
    }

    const body = await readBody(event);
    const data = normalizeRepairOrderData(body);
    if (data.parkId && !authorizedParkIds.includes(Number(data.parkId))) {
      return useResponseError('没有操作权限');
    }

    const result = await prismaClient.repairOrder.update({
      data,
      where: {
        repairOrderId,
      },
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('更新报修工单失败:', error);
    return serverErrorResponse('更新报修工单失败', event);
  }
});
